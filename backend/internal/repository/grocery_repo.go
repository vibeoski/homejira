package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type groceryRepo struct {
	db *pgxpool.Pool
}

// NewGroceryRepository returns a Postgres-backed GroceryRepository.
func NewGroceryRepository(db *pgxpool.Pool) domain.GroceryRepository {
	return &groceryRepo{db: db}
}

const grocerySelectCols = `
	g.id, g.title, g.quantity, g.notes, g.done, g.done_at, g.created_at, g.updated_at, g.household_id, g.assignee_id,
	m.id, COALESCE(m.name, ''), COALESCE(m.avatar, ''), COALESCE(m.color, ''), m.created_at
`

func scanGroceryWithMember(row pgx.Row) (*domain.Grocery, error) {
	var g domain.Grocery
	var mID nullUUID
	var mName, mAvatar, mColor string
	var mCreatedAt *time.Time
	err := row.Scan(
		&g.ID, &g.Title, &g.Quantity, &g.Notes, &g.Done, &g.DoneAt, &g.CreatedAt, &g.UpdatedAt, &g.HouseholdID, &g.AssigneeID,
		&mID, &mName, &mAvatar, &mColor, &mCreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if mID.Valid {
		m := domain.Member{
			ID:     mID.UUID,
			Name:   mName,
			Avatar: mAvatar,
			Color:  mColor,
		}
		if mCreatedAt != nil {
			m.CreatedAt = *mCreatedAt
		}
		g.Assignee = &m
	}
	return &g, nil
}

func (r *groceryRepo) FindAll(filter domain.GroceryFilter) ([]domain.Grocery, error) {
	where := []string{"1=1"}
	args := []any{}
	i := 1

	if filter.HouseholdID != uuid.Nil {
		where = append(where, fmt.Sprintf("g.household_id = $%d", i))
		args = append(args, filter.HouseholdID)
		i++
	}
	if filter.Done != nil {
		where = append(where, fmt.Sprintf("g.done = $%d", i))
		args = append(args, *filter.Done)
		i++
	}
	if filter.Search != "" {
		where = append(where, fmt.Sprintf("g.title ILIKE $%d", i))
		args = append(args, "%"+filter.Search+"%")
		i++
	}

	q := fmt.Sprintf(`
		SELECT %s
		FROM groceries g
		LEFT JOIN members m ON m.id = g.assignee_id
		WHERE %s
		ORDER BY g.done ASC, g.created_at DESC
	`, grocerySelectCols, strings.Join(where, " AND "))

	rows, err := r.db.Query(context.Background(), q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groceries := make([]domain.Grocery, 0)
	for rows.Next() {
		g, err := scanGroceryWithMember(rows)
		if err != nil {
			return nil, err
		}
		groceries = append(groceries, *g)
	}
	return groceries, rows.Err()
}

func (r *groceryRepo) FindByID(id uuid.UUID) (*domain.Grocery, error) {
	row := r.db.QueryRow(context.Background(), fmt.Sprintf(`
		SELECT %s
		FROM groceries g
		LEFT JOIN members m ON m.id = g.assignee_id
		WHERE g.id = $1
	`, grocerySelectCols), id)

	return scanGroceryWithMember(row)
}

func (r *groceryRepo) Create(input domain.CreateGroceryInput) (*domain.Grocery, error) {
	row := r.db.QueryRow(context.Background(), fmt.Sprintf(`
		WITH ins AS (
			INSERT INTO groceries (title, quantity, notes, household_id, assignee_id)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING *
		)
		SELECT %s FROM ins g
		LEFT JOIN members m ON m.id = g.assignee_id
	`, grocerySelectCols),
		input.Title, input.Quantity, input.Notes, input.HouseholdID, input.AssigneeID,
	)
	return scanGroceryWithMember(row)
}

func (r *groceryRepo) Update(id uuid.UUID, input domain.UpdateGroceryInput) (*domain.Grocery, error) {
	setClauses := []string{}
	args := []any{}
	i := 1

	if input.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", i))
		args = append(args, *input.Title)
		i++
	}
	if input.Quantity != nil {
		setClauses = append(setClauses, fmt.Sprintf("quantity = $%d", i))
		args = append(args, *input.Quantity)
		i++
	}
	if input.Notes != nil {
		setClauses = append(setClauses, fmt.Sprintf("notes = $%d", i))
		args = append(args, *input.Notes)
		i++
	}
	if input.Done != nil {
		setClauses = append(setClauses, fmt.Sprintf("done = $%d", i))
		args = append(args, *input.Done)
		i++
		if *input.Done {
			now := time.Now()
			setClauses = append(setClauses, fmt.Sprintf("done_at = $%d", i))
			args = append(args, now)
			i++
		} else {
			setClauses = append(setClauses, fmt.Sprintf("done_at = NULL"))
		}
	}
	if input.AssigneeID != nil {
		setClauses = append(setClauses, fmt.Sprintf("assignee_id = $%d", i))
		args = append(args, *input.AssigneeID)
		i++
	}

	if len(setClauses) == 0 {
		return r.FindByID(id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = NOW()"))
	args = append(args, id)

	row := r.db.QueryRow(context.Background(), fmt.Sprintf(`
		WITH upd AS (
			UPDATE groceries SET %s WHERE id = $%d RETURNING *
		)
		SELECT %s FROM upd g
		LEFT JOIN members m ON m.id = g.assignee_id
	`, strings.Join(setClauses, ", "), i, grocerySelectCols), args...)

	return scanGroceryWithMember(row)
}

func (r *groceryRepo) Delete(id uuid.UUID) error {
	tag, err := r.db.Exec(context.Background(), `DELETE FROM groceries WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

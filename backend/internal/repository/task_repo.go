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

// nullUUID is a helper for scanning a potentially-NULL UUID column.
type nullUUID struct {
	UUID  uuid.UUID
	Valid bool
}

func (n *nullUUID) Scan(v any) error {
	if v == nil {
		n.Valid = false
		return nil
	}
	n.Valid = true
	if u, ok := v.(uuid.UUID); ok {
		n.UUID = u
		return nil
	}
	if b, ok := v.([16]byte); ok {
		n.UUID = uuid.UUID(b)
		return nil
	}
	return fmt.Errorf("nullUUID: cannot scan type %T", v)
}

type taskRepo struct {
	db *pgxpool.Pool
}

// NewTaskRepository returns a Postgres-backed TaskRepository.
func NewTaskRepository(db *pgxpool.Pool) domain.TaskRepository {
	return &taskRepo{db: db}
}

const taskSelectCols = `
	t.id, t.title, t.notes, t.category, t.priority,
	t.assignee_id, t.household_id, t.done, t.done_at, t.due_at, t.created_at, t.updated_at,
	m.id, COALESCE(m.name, ''), COALESCE(m.avatar, ''), COALESCE(m.color, ''), m.created_at
`

func scanTaskWithMember(row pgx.Row) (*domain.Task, error) {
	var t domain.Task
	var mID nullUUID
	var mName, mAvatar, mColor string
	var mCreatedAt *time.Time
	err := row.Scan(
		&t.ID, &t.Title, &t.Notes, &t.Category, &t.Priority,
		&t.AssigneeID, &t.HouseholdID, &t.Done, &t.DoneAt, &t.DueAt, &t.CreatedAt, &t.UpdatedAt,
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
		t.Assignee = &m
	}
	return &t, nil
}

func (r *taskRepo) FindAll(filter domain.TaskFilter) ([]domain.Task, error) {
	where := []string{"1=1"}
	args := []any{}
	i := 1

	if filter.HouseholdID != nil {
		where = append(where, fmt.Sprintf("t.household_id = $%d", i))
		args = append(args, *filter.HouseholdID)
		i++
	}
	if filter.Category != nil {
		where = append(where, fmt.Sprintf("t.category = $%d", i))
		args = append(args, string(*filter.Category))
		i++
	}
	if filter.Done != nil {
		where = append(where, fmt.Sprintf("t.done = $%d", i))
		args = append(args, *filter.Done)
		i++
	}
	if filter.Search != "" {
		where = append(where, fmt.Sprintf("t.title ILIKE $%d", i))
		args = append(args, "%"+filter.Search+"%")
		i++
	}

	q := fmt.Sprintf(`
		SELECT %s
		FROM tasks t
		LEFT JOIN members m ON m.id = t.assignee_id
		WHERE %s
		ORDER BY
			CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
			t.done ASC,
			t.created_at DESC
	`, taskSelectCols, strings.Join(where, " AND "))

	rows, err := r.db.Query(context.Background(), q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]domain.Task, 0)
	for rows.Next() {
		var t domain.Task
		var mID nullUUID
		var mName, mAvatar, mColor string
		var mCreatedAt *time.Time
		if err := rows.Scan(
			&t.ID, &t.Title, &t.Notes, &t.Category, &t.Priority,
			&t.AssigneeID, &t.HouseholdID, &t.Done, &t.DoneAt, &t.DueAt, &t.CreatedAt, &t.UpdatedAt,
			&mID, &mName, &mAvatar, &mColor, &mCreatedAt,
		); err != nil {
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
			t.Assignee = &m
		}
		tasks = append(tasks, t)
	}

	// Fetch comments for all tasks in one query
	if len(tasks) > 0 {
		if err := r.populateComments(tasks); err != nil {
			return nil, err
		}
	}

	return tasks, nil
}

func (r *taskRepo) FindByID(id uuid.UUID) (*domain.Task, error) {
	row := r.db.QueryRow(context.Background(), fmt.Sprintf(`
		SELECT %s
		FROM tasks t
		LEFT JOIN members m ON m.id = t.assignee_id
		WHERE t.id = $1
	`, taskSelectCols), id)

	t, err := scanTaskWithMember(row)
	if err != nil {
		return nil, err
	}

	comments, err := r.fetchComments([]uuid.UUID{t.ID})
	if err != nil {
		return nil, err
	}
	t.Comments = comments[t.ID]
	return t, nil
}

func (r *taskRepo) Create(input domain.CreateTaskInput) (*domain.Task, error) {
	row := r.db.QueryRow(context.Background(), fmt.Sprintf(`
		WITH ins AS (
			INSERT INTO tasks (title, notes, category, priority, assignee_id, household_id, due_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING *
		)
		SELECT %s FROM ins t
		LEFT JOIN members m ON m.id = t.assignee_id
	`, taskSelectCols),
		input.Title, input.Notes, input.Category, input.Priority, input.AssigneeID, input.HouseholdID, input.DueAt,
	)
	return scanTaskWithMember(row)
}

func (r *taskRepo) Update(id uuid.UUID, input domain.UpdateTaskInput) (*domain.Task, error) {
	setClauses := []string{}
	args := []any{}
	i := 1

	if input.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", i))
		args = append(args, *input.Title)
		i++
	}
	if input.Notes != nil {
		setClauses = append(setClauses, fmt.Sprintf("notes = $%d", i))
		args = append(args, *input.Notes)
		i++
	}
	if input.Category != nil {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", i))
		args = append(args, string(*input.Category))
		i++
	}
	if input.Priority != nil {
		setClauses = append(setClauses, fmt.Sprintf("priority = $%d", i))
		args = append(args, string(*input.Priority))
		i++
	}
	if input.AssigneeID != nil {
		setClauses = append(setClauses, fmt.Sprintf("assignee_id = $%d", i))
		args = append(args, *input.AssigneeID)
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
			setClauses = append(setClauses, fmt.Sprintf("done_at = $%d", i))
			args = append(args, nil)
			i++
		}
	}
	if input.DueAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("due_at = $%d", i))
		args = append(args, *input.DueAt)
		i++
	} else if input.ClearDueAt {
		setClauses = append(setClauses, fmt.Sprintf("due_at = $%d", i))
		args = append(args, nil)
		i++
	}

	if len(setClauses) == 0 {
		return r.FindByID(id)
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now())
	i++
	args = append(args, id)

	row := r.db.QueryRow(context.Background(), fmt.Sprintf(`
		WITH upd AS (
			UPDATE tasks SET %s WHERE id = $%d RETURNING *
		)
		SELECT %s FROM upd t
		LEFT JOIN members m ON m.id = t.assignee_id
	`, strings.Join(setClauses, ", "), i, taskSelectCols), args...)

	return scanTaskWithMember(row)
}

func (r *taskRepo) Delete(id uuid.UUID) error {
	tag, err := r.db.Exec(context.Background(), `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *taskRepo) AddComment(taskID uuid.UUID, authorID uuid.UUID, body string) (*domain.Comment, error) {
	var c domain.Comment
	var author domain.Member
	err := r.db.QueryRow(context.Background(), `
		WITH ins AS (
			INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3)
			RETURNING *
		)
		SELECT ins.id, ins.task_id, ins.author_id, ins.body, ins.created_at,
		       m.id, m.name, m.avatar, m.color, m.created_at
		FROM ins JOIN members m ON m.id = ins.author_id
	`, taskID, authorID, body).Scan(
		&c.ID, &c.TaskID, &c.AuthorID, &c.Body, &c.CreatedAt,
		&author.ID, &author.Name, &author.Avatar, &author.Color, &author.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	c.Author = &author
	return &c, nil
}

// populateComments fetches and attaches comments to a task slice.
func (r *taskRepo) populateComments(tasks []domain.Task) error {
	ids := make([]uuid.UUID, len(tasks))
	for i, t := range tasks {
		ids[i] = t.ID
	}

	comments, err := r.fetchComments(ids)
	if err != nil {
		return err
	}
	for i := range tasks {
		tasks[i].Comments = comments[tasks[i].ID]
		if tasks[i].Comments == nil {
			tasks[i].Comments = []domain.Comment{}
		}
	}
	return nil
}

func (r *taskRepo) ReassignTasks(fromMemberID, toMemberID, householdID uuid.UUID) error {
	_, err := r.db.Exec(context.Background(), `
		UPDATE tasks
		SET assignee_id = $1, updated_at = NOW()
		WHERE assignee_id = $2 AND household_id = $3 AND done = false
	`, toMemberID, fromMemberID, householdID)
	return err
}

func (r *taskRepo) fetchComments(taskIDs []uuid.UUID) (map[uuid.UUID][]domain.Comment, error) {
	result := make(map[uuid.UUID][]domain.Comment)

	rows, err := r.db.Query(context.Background(), `
		SELECT c.id, c.task_id, c.author_id, c.body, c.created_at,
		       m.id, m.name, m.avatar, m.color, m.created_at
		FROM comments c
		JOIN members m ON m.id = c.author_id
		WHERE c.task_id = ANY($1)
		ORDER BY c.created_at ASC
	`, taskIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var c domain.Comment
		var author domain.Member
		if err := rows.Scan(
			&c.ID, &c.TaskID, &c.AuthorID, &c.Body, &c.CreatedAt,
			&author.ID, &author.Name, &author.Avatar, &author.Color, &author.CreatedAt,
		); err != nil {
			return nil, err
		}
		c.Author = &author
		result[c.TaskID] = append(result[c.TaskID], c)
	}
	return result, nil
}

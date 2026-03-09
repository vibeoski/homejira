package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type householdRepo struct {
	db *pgxpool.Pool
}

// NewHouseholdRepository returns a Postgres-backed HouseholdRepository.
func NewHouseholdRepository(db *pgxpool.Pool) domain.HouseholdRepository {
	return &householdRepo{db: db}
}

func (r *householdRepo) Create(name string, kind domain.HouseholdKind, createdBy uuid.UUID, joinCode string) (*domain.Household, error) {
	var h domain.Household
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO households (name, kind, join_code, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, kind, join_code, created_by, created_at
	`, name, string(kind), joinCode, createdBy).Scan(
		&h.ID, &h.Name, &h.Kind, &h.JoinCode, &h.CreatedBy, &h.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &h, nil
}

func (r *householdRepo) FindByID(id uuid.UUID) (*domain.Household, error) {
	var h domain.Household
	err := r.db.QueryRow(context.Background(), `
		SELECT id, name, kind, join_code, created_by, created_at
		FROM households
		WHERE id = $1
	`, id).Scan(&h.ID, &h.Name, &h.Kind, &h.JoinCode, &h.CreatedBy, &h.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

func (r *householdRepo) FindByJoinCode(joinCode string) (*domain.Household, error) {
	var h domain.Household
	err := r.db.QueryRow(context.Background(), `
		SELECT id, name, kind, join_code, created_by, created_at
		FROM households
		WHERE join_code = $1
	`, joinCode).Scan(&h.ID, &h.Name, &h.Kind, &h.JoinCode, &h.CreatedBy, &h.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// Delete removes the household and cascades to tasks, join requests, and invite links.
// Members have their household_id cleared (ON DELETE SET NULL).
func (r *householdRepo) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(context.Background(), `DELETE FROM households WHERE id = $1`, id)
	return err
}


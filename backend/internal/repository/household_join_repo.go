package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type householdJoinRepo struct {
	db *pgxpool.Pool
}

// NewHouseholdJoinRequestRepository returns a Postgres-backed HouseholdJoinRequestRepository.
func NewHouseholdJoinRequestRepository(db *pgxpool.Pool) domain.HouseholdJoinRequestRepository {
	return &householdJoinRepo{db: db}
}

func (r *householdJoinRepo) Create(householdID uuid.UUID, requesterID uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	var jr domain.HouseholdJoinRequest
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO household_join_requests (household_id, requester_id)
		VALUES ($1, $2)
		RETURNING id, household_id, requester_id, status, created_at, decided_at, decided_by, COALESCE(note, '')
	`, householdID, requesterID).Scan(
		&jr.ID, &jr.HouseholdID, &jr.RequesterID, &jr.Status, &jr.CreatedAt, &jr.DecidedAt, &jr.DecidedBy, &jr.Note,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("%w: join request already pending for this household", domain.ErrAlreadyExists)
		}
		return nil, err
	}
	return &jr, nil
}

func (r *householdJoinRepo) FindPendingByHousehold(householdID uuid.UUID) ([]domain.HouseholdJoinRequest, error) {
	rows, err := r.db.Query(context.Background(), `
		SELECT jr.id, jr.household_id, jr.requester_id, jr.status, jr.created_at, jr.decided_at, jr.decided_by, COALESCE(jr.note, ''),
		       m.id, m.name, m.avatar, m.color
		FROM household_join_requests jr
		JOIN members m ON m.id = jr.requester_id
		WHERE jr.household_id = $1 AND jr.status = 'pending'
		ORDER BY jr.created_at ASC
	`, householdID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.HouseholdJoinRequest, 0)
	for rows.Next() {
		var jr domain.HouseholdJoinRequest
		var req domain.Member
		if err := rows.Scan(
			&jr.ID, &jr.HouseholdID, &jr.RequesterID, &jr.Status, &jr.CreatedAt, &jr.DecidedAt, &jr.DecidedBy, &jr.Note,
			&req.ID, &req.Name, &req.Avatar, &req.Color,
		); err != nil {
			return nil, err
		}
		jr.Requester = &req
		out = append(out, jr)
	}
	return out, rows.Err()
}

func (r *householdJoinRepo) FindByID(id uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	var jr domain.HouseholdJoinRequest
	err := r.db.QueryRow(context.Background(), `
		SELECT id, household_id, requester_id, status, created_at, decided_at, decided_by, COALESCE(note, '')
		FROM household_join_requests
		WHERE id = $1
	`, id).Scan(
		&jr.ID, &jr.HouseholdID, &jr.RequesterID, &jr.Status, &jr.CreatedAt, &jr.DecidedAt, &jr.DecidedBy, &jr.Note,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &jr, nil
}

func (r *householdJoinRepo) FindPendingByRequester(requesterID uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	var jr domain.HouseholdJoinRequest
	var h domain.Household
	err := r.db.QueryRow(context.Background(), `
		SELECT jr.id, jr.household_id, jr.requester_id, jr.status, jr.created_at, jr.decided_at, jr.decided_by, COALESCE(jr.note, ''),
		       h.id, h.name, h.kind, h.join_code, h.created_by, h.created_at
		FROM household_join_requests jr
		JOIN households h ON h.id = jr.household_id
		WHERE jr.requester_id = $1 AND jr.status = 'pending'
		LIMIT 1
	`, requesterID).Scan(
		&jr.ID, &jr.HouseholdID, &jr.RequesterID, &jr.Status, &jr.CreatedAt, &jr.DecidedAt, &jr.DecidedBy, &jr.Note,
		&h.ID, &h.Name, &h.Kind, &h.JoinCode, &h.CreatedBy, &h.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	jr.Household = &h
	return &jr, nil
}

func (r *householdJoinRepo) DeleteByID(id uuid.UUID) error {
	tag, err := r.db.Exec(context.Background(), `
		DELETE FROM household_join_requests WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *householdJoinRepo) UpdateStatus(id uuid.UUID, status domain.JoinRequestStatus, decidedBy uuid.UUID) (*domain.HouseholdJoinRequest, error) {
	now := time.Now()
	var jr domain.HouseholdJoinRequest
	err := r.db.QueryRow(context.Background(), `
		UPDATE household_join_requests
		SET status = $2, decided_at = $3, decided_by = $4
		WHERE id = $1
		RETURNING id, household_id, requester_id, status, created_at, decided_at, decided_by, COALESCE(note, '')
	`, id, status, now, decidedBy).Scan(
		&jr.ID, &jr.HouseholdID, &jr.RequesterID, &jr.Status, &jr.CreatedAt, &jr.DecidedAt, &jr.DecidedBy, &jr.Note,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &jr, nil
}

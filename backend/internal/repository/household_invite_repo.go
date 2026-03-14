package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type householdInviteRepo struct {
	db *pgxpool.Pool
}

// NewHouseholdInviteRepository returns a Postgres-backed HouseholdInviteRepository.
func NewHouseholdInviteRepository(db *pgxpool.Pool) domain.HouseholdInviteRepository {
	return &householdInviteRepo{db: db}
}

func (r *householdInviteRepo) Create(householdID uuid.UUID, invitedPhone, invitedName string, createdBy uuid.UUID) (*domain.HouseholdInvite, error) {
	var inv domain.HouseholdInvite
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO household_invites (household_id, invited_phone, invited_name, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, household_id, invited_phone, invited_name, status, created_by, created_at
	`, householdID, invitedPhone, invitedName, createdBy).Scan(
		&inv.ID, &inv.HouseholdID, &inv.InvitedPhone, &inv.InvitedName, &inv.Status, &inv.CreatedBy, &inv.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *householdInviteRepo) FindPendingForPhone(phone string) ([]domain.HouseholdInvite, error) {
	rows, err := r.db.Query(context.Background(), `
		SELECT id, household_id, invited_phone, invited_name, status, created_by, created_at
		FROM household_invites
		WHERE invited_phone = $1 AND status = 'pending'
		ORDER BY created_at ASC
	`, phone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.HouseholdInvite, 0)
	for rows.Next() {
		var inv domain.HouseholdInvite
		if err := rows.Scan(
			&inv.ID, &inv.HouseholdID, &inv.InvitedPhone, &inv.InvitedName, &inv.Status, &inv.CreatedBy, &inv.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (r *householdInviteRepo) FindByID(id uuid.UUID) (*domain.HouseholdInvite, error) {
	var inv domain.HouseholdInvite
	err := r.db.QueryRow(context.Background(), `
		SELECT id, household_id, invited_phone, invited_name, status, created_by, created_at
		FROM household_invites
		WHERE id = $1
	`, id).Scan(
		&inv.ID, &inv.HouseholdID, &inv.InvitedPhone, &inv.InvitedName, &inv.Status, &inv.CreatedBy, &inv.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &inv, nil
}

func (r *householdInviteRepo) UpdateStatus(id uuid.UUID, status domain.InviteStatus) (*domain.HouseholdInvite, error) {
	var inv domain.HouseholdInvite
	err := r.db.QueryRow(context.Background(), `
		UPDATE household_invites
		SET status = $2
		WHERE id = $1
		RETURNING id, household_id, invited_phone, invited_name, status, created_by, created_at
	`, id, status).Scan(
		&inv.ID, &inv.HouseholdID, &inv.InvitedPhone, &inv.InvitedName, &inv.Status, &inv.CreatedBy, &inv.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &inv, nil
}


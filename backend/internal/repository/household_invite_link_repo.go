package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type householdInviteLinkRepo struct {
	db *pgxpool.Pool
}

// NewHouseholdInviteLinkRepository returns a Postgres-backed HouseholdInviteLinkRepository.
func NewHouseholdInviteLinkRepository(db *pgxpool.Pool) domain.HouseholdInviteLinkRepository {
	return &householdInviteLinkRepo{db: db}
}

func (r *householdInviteLinkRepo) Create(householdID, createdBy uuid.UUID, token string, expiresAt time.Time) (*domain.HouseholdInviteLink, error) {
	var l domain.HouseholdInviteLink
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO household_invite_links (household_id, created_by, token, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, household_id, created_by, token, expires_at, created_at
	`, householdID, createdBy, token, expiresAt).Scan(
		&l.ID, &l.HouseholdID, &l.CreatedBy, &l.Token, &l.ExpiresAt, &l.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *householdInviteLinkRepo) FindByToken(token string) (*domain.HouseholdInviteLink, error) {
	var l domain.HouseholdInviteLink
	err := r.db.QueryRow(context.Background(), `
		SELECT id, household_id, created_by, token, expires_at, created_at
		FROM household_invite_links
		WHERE token = $1 AND expires_at > NOW()
	`, token).Scan(&l.ID, &l.HouseholdID, &l.CreatedBy, &l.Token, &l.ExpiresAt, &l.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &l, nil
}

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

type verificationRepo struct {
	db *pgxpool.Pool
}

// NewVerificationRepository returns a Postgres-backed VerificationRepository.
func NewVerificationRepository(db *pgxpool.Pool) domain.VerificationRepository {
	return &verificationRepo{db: db}
}

func (r *verificationRepo) CreateEmailToken(memberID uuid.UUID, token string, expiresAt time.Time) (*domain.EmailVerification, error) {
	var v domain.EmailVerification
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO email_verifications (member_id, token, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, member_id, token, expires_at, used, created_at
	`, memberID, token, expiresAt).Scan(
		&v.ID, &v.MemberID, &v.Token, &v.ExpiresAt, &v.Used, &v.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *verificationRepo) FindEmailToken(token string) (*domain.EmailVerification, error) {
	var v domain.EmailVerification
	err := r.db.QueryRow(context.Background(), `
		SELECT id, member_id, token, expires_at, used, created_at
		FROM email_verifications
		WHERE token = $1
	`, token).Scan(
		&v.ID, &v.MemberID, &v.Token, &v.ExpiresAt, &v.Used, &v.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *verificationRepo) MarkEmailTokenUsed(id uuid.UUID) error {
	_, err := r.db.Exec(context.Background(), `
		UPDATE email_verifications SET used = true WHERE id = $1
	`, id)
	return err
}

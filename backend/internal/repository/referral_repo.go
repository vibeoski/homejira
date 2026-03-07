package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type referralRepo struct {
	db *pgxpool.Pool
}

func NewReferralRepository(db *pgxpool.Pool) domain.ReferralRepository {
	return &referralRepo{db: db}
}

// Upsert inserts a new referral link for the member, or returns the existing one.
func (r *referralRepo) Upsert(memberID uuid.UUID, token string) (*domain.ReferralLink, error) {
	var link domain.ReferralLink
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO referral_links (member_id, token)
		VALUES ($1, $2)
		ON CONFLICT (member_id) DO UPDATE SET member_id = EXCLUDED.member_id
		RETURNING id, member_id, token, created_at
	`, memberID, token).Scan(&link.ID, &link.MemberID, &link.Token, &link.CreatedAt)
	return &link, err
}

func (r *referralRepo) FindByToken(token string) (*domain.ReferralLink, error) {
	var link domain.ReferralLink
	err := r.db.QueryRow(context.Background(), `
		SELECT id, member_id, token, created_at FROM referral_links WHERE token = $1
	`, token).Scan(&link.ID, &link.MemberID, &link.Token, &link.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &link, err
}

func (r *referralRepo) FindByMember(memberID uuid.UUID) (*domain.ReferralLink, error) {
	var link domain.ReferralLink
	err := r.db.QueryRow(context.Background(), `
		SELECT id, member_id, token, created_at FROM referral_links WHERE member_id = $1
	`, memberID).Scan(&link.ID, &link.MemberID, &link.Token, &link.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &link, err
}

package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type memberRepo struct {
	db *pgxpool.Pool
}

// NewMemberRepository returns a Postgres-backed MemberRepository.
func NewMemberRepository(db *pgxpool.Pool) domain.MemberRepository {
	return &memberRepo{db: db}
}

func (r *memberRepo) FindAll() ([]domain.Member, error) {
	rows, err := r.db.Query(context.Background(), `
		SELECT id, name, avatar, color, phone, household_id, role,
		       COALESCE(email, ''), email_verified, phone_verified, created_at
		FROM members
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []domain.Member
	for rows.Next() {
		var m domain.Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
			&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *memberRepo) FindByHousehold(householdID uuid.UUID) ([]domain.Member, error) {
	rows, err := r.db.Query(context.Background(), `
		SELECT id, name, avatar, color, phone, household_id, role,
		       COALESCE(email, ''), email_verified, phone_verified, created_at
		FROM members
		WHERE household_id = $1
		ORDER BY created_at ASC
	`, householdID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []domain.Member
	for rows.Next() {
		var m domain.Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
			&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *memberRepo) FindByID(id uuid.UUID) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		SELECT id, name, avatar, color, phone, household_id, role,
		       COALESCE(email, ''), email_verified, phone_verified, created_at
		FROM members WHERE id = $1
	`, id).Scan(&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *memberRepo) Create(name, avatar, color string) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO members (name, avatar, color)
		VALUES ($1, $2, $3)
		RETURNING id, name, avatar, color, phone, household_id, role,
		          COALESCE(email, ''), email_verified, phone_verified, created_at
	`, name, avatar, color).Scan(&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// FindByPhone looks up a member by phone number (includes mpin_hash for auth).
func (r *memberRepo) FindByPhone(phone string) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		SELECT id, name, avatar, color, phone, mpin_hash, household_id, role,
		       COALESCE(email, ''), email_verified, phone_verified, created_at
		FROM members WHERE phone = $1
	`, phone).Scan(&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.MpinHash, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CreateWithAuth inserts a new member with phone and mPIN credentials.
func (r *memberRepo) CreateWithAuth(name, avatar, color, phone, mpinHash string) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		INSERT INTO members (name, avatar, color, phone, mpin_hash)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, avatar, color, phone, household_id, role,
		          COALESCE(email, ''), email_verified, phone_verified, created_at
	`, name, avatar, color, phone, mpinHash).Scan(
		&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, domain.ErrAlreadyExists
		}
		return nil, err
	}
	return &m, nil
}

// ClearHousehold removes a member from their household and resets their role to 'member'.
func (r *memberRepo) ClearHousehold(id uuid.UUID) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		UPDATE members
		SET household_id = NULL, role = 'member'
		WHERE id = $1
		RETURNING id, name, avatar, color, phone, household_id, role,
		          COALESCE(email, ''), email_verified, phone_verified, created_at
	`, id).Scan(
		&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// UpdateMpin sets the member's mPIN hash.
func (r *memberRepo) UpdateMpin(id uuid.UUID, mpinHash string) error {
	tag, err := r.db.Exec(context.Background(), `
		UPDATE members SET mpin_hash = $2 WHERE id = $1
	`, id, mpinHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// UpdateProfile sets the member's name, avatar, and color.
func (r *memberRepo) UpdateProfile(id uuid.UUID, name, avatar, color string) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		UPDATE members
		SET name = $2, avatar = $3, color = $4
		WHERE id = $1
		RETURNING id, name, avatar, color, phone, household_id, role,
		          COALESCE(email, ''), email_verified, phone_verified, created_at
	`, id, name, avatar, color).Scan(
		&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// UpdateEmail sets the member's email address.
func (r *memberRepo) UpdateEmail(id uuid.UUID, email string) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		UPDATE members
		SET email = $2
		WHERE id = $1
		RETURNING id, name, avatar, color, phone, household_id, role,
		          COALESCE(email, ''), email_verified, phone_verified, created_at
	`, id, email).Scan(
		&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, domain.ErrAlreadyExists
		}
		return nil, err
	}
	return &m, nil
}

// SetPhoneVerified marks the member's phone as verified.
func (r *memberRepo) SetPhoneVerified(id uuid.UUID) error {
	_, err := r.db.Exec(context.Background(), `
		UPDATE members SET phone_verified = true WHERE id = $1
	`, id)
	return err
}

// SetEmailVerified marks the member's email as verified.
func (r *memberRepo) SetEmailVerified(id uuid.UUID) error {
	_, err := r.db.Exec(context.Background(), `
		UPDATE members SET email_verified = true WHERE id = $1
	`, id)
	return err
}

// UpdateHouseholdAndRole sets the member's household and role in one statement.
func (r *memberRepo) UpdateHouseholdAndRole(id uuid.UUID, householdID *uuid.UUID, role domain.MemberRole) (*domain.Member, error) {
	var m domain.Member
	err := r.db.QueryRow(context.Background(), `
		UPDATE members
		SET household_id = $2, role = $3
		WHERE id = $1
		RETURNING id, name, avatar, color, phone, household_id, role,
		          COALESCE(email, ''), email_verified, phone_verified, created_at
	`, id, householdID, role).Scan(
		&m.ID, &m.Name, &m.Avatar, &m.Color, &m.Phone, &m.HouseholdID, &m.Role,
		&m.Email, &m.EmailVerified, &m.PhoneVerified, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}


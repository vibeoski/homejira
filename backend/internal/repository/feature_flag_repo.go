package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type featureFlagRepo struct {
	db *pgxpool.Pool
}

// NewFeatureFlagRepository returns a domain.FeatureFlagRepository backed by Postgres.
func NewFeatureFlagRepository(db *pgxpool.Pool) domain.FeatureFlagRepository {
	return &featureFlagRepo{db: db}
}

// IsEnabled returns whether the given flag key is enabled.
// Returns false (not an error) when the key does not exist.
func (r *featureFlagRepo) IsEnabled(key string) (bool, error) {
	var enabled bool
	err := r.db.QueryRow(context.Background(),
		`SELECT enabled FROM feature_flags WHERE key = $1`, key,
	).Scan(&enabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return enabled, nil
}

// List returns all feature flags ordered by key.
func (r *featureFlagRepo) List() ([]domain.FeatureFlag, error) {
	rows, err := r.db.Query(context.Background(),
		`SELECT key, enabled, updated_at FROM feature_flags ORDER BY key`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flags []domain.FeatureFlag
	for rows.Next() {
		var f domain.FeatureFlag
		if err := rows.Scan(&f.Key, &f.Enabled, &f.UpdatedAt); err != nil {
			return nil, err
		}
		flags = append(flags, f)
	}
	return flags, rows.Err()
}

package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/internal/domain"
)

type coinRepo struct {
	db *pgxpool.Pool
}

func NewCoinRepository(db *pgxpool.Pool) domain.CoinRepository {
	return &coinRepo{db: db}
}

// Award inserts a transaction record and increments the member's coin balance atomically.
func (r *coinRepo) Award(memberID uuid.UUID, amount int, reason string, meta map[string]interface{}) error {
	var metaJSON []byte
	if meta != nil {
		var err error
		metaJSON, err = json.Marshal(meta)
		if err != nil {
			return err
		}
	}

	tx, err := r.db.Begin(context.Background())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background()) //nolint:errcheck

	_, err = tx.Exec(context.Background(), `
		INSERT INTO coin_transactions (member_id, amount, reason, meta)
		VALUES ($1, $2, $3, $4)
	`, memberID, amount, reason, metaJSON)
	if err != nil {
		return err
	}

	_, err = tx.Exec(context.Background(), `
		UPDATE members SET coins = coins + $2 WHERE id = $1
	`, memberID, amount)
	if err != nil {
		return err
	}

	return tx.Commit(context.Background())
}

func (r *coinRepo) GetBalance(memberID uuid.UUID) (int, error) {
	var balance int
	err := r.db.QueryRow(context.Background(), `
		SELECT coins FROM members WHERE id = $1
	`, memberID).Scan(&balance)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, domain.ErrNotFound
	}
	return balance, err
}

func (r *coinRepo) ListTransactions(memberID uuid.UUID) ([]domain.CoinTransaction, error) {
	rows, err := r.db.Query(context.Background(), `
		SELECT id, member_id, amount, reason, meta, created_at
		FROM coin_transactions
		WHERE member_id = $1
		ORDER BY created_at DESC
	`, memberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	txns := make([]domain.CoinTransaction, 0)
	for rows.Next() {
		var t domain.CoinTransaction
		var metaRaw []byte
		if err := rows.Scan(&t.ID, &t.MemberID, &t.Amount, &t.Reason, &metaRaw, &t.CreatedAt); err != nil {
			return nil, err
		}
		if metaRaw != nil {
			_ = json.Unmarshal(metaRaw, &t.Meta)
		}
		txns = append(txns, t)
	}
	return txns, nil
}

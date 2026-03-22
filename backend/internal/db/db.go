package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(url string) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("could not parse database URL: %w", err)
	}

	cfg.MaxConns = 25
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	for i := 0; i < 10; i++ {
		pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				return pool, nil
			}
		}
		log.Printf("DB not ready, retrying in 2s... (%d/10)", i+1)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("could not connect to database after retries")
}

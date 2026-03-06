package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/homejira/api/config"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	defer db.Close()

	data, err := os.ReadFile("internal/db/migrations/seed.sql")
	if err != nil {
		log.Fatalf("read seed.sql: %v", err)
	}

	_, err = db.Exec(ctx, string(data))
	if err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	fmt.Println("✓ Database seeded with sample household data")
}

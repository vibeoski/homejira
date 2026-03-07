package main

import (
	"log"

	"github.com/homejira/api/config"
	"github.com/homejira/api/internal/db"
	"github.com/homejira/api/internal/server"
)

func main() {
	cfg := config.Load()

	// ── Database ──────────────────────────────────────────────────
	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("✓ Database connected")

	// Run migrations
	if err := db.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	log.Printf("CORS_ORIGINS=%q", cfg.CORSOrigins)

	// ── Server ────────────────────────────────────────────────────
	srv := server.New(&cfg, pool)

	if err := srv.Start(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

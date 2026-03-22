package config

import (
	"log/slog"
	"os"
)

type Config struct {
	DatabaseURL string
	Port        string
	Env         string
	CORSOrigins string
	JWTSecret   string
	AppBaseURL  string // APP_BASE_URL env var
}

func Load() Config {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		slog.Error("JWT_SECRET env var is required")
		os.Exit(1)
	}

	cfg := Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://homejira:homejira_secret@localhost:5432/homejira?sslmode=disable"),
		Port:        getEnv("PORT", "8080"),
		Env:         getEnv("ENV", "development"),
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000"),
		JWTSecret:   jwtSecret,
		AppBaseURL:  getEnv("APP_BASE_URL", "http://localhost:3000"),
	}
	slog.Info("config loaded", "env", cfg.Env, "port", cfg.Port)
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

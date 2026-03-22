package config

import (
	"log"
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
		log.Fatal("JWT_SECRET env var is required")
	}

	cfg := Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://homejira:homejira_secret@localhost:5432/homejira?sslmode=disable"),
		Port:        getEnv("PORT", "8080"),
		Env:         getEnv("ENV", "development"),
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000"),
		JWTSecret:   jwtSecret,
		AppBaseURL:  getEnv("APP_BASE_URL", "http://localhost:3000"),
	}
	log.Printf("Config loaded: env=%s port=%s", cfg.Env, cfg.Port)
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

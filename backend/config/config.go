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
}

func Load() Config {
	cfg := Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://homejira:homejira_secret@localhost:5432/homejira?sslmode=disable"),
		Port:        getEnv("PORT", "8080"),
		Env:         getEnv("ENV", "development"),
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000"),
		JWTSecret:   getEnv("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION_32_CHARS!"),
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

.PHONY: help up dev down restart build logs logs-api logs-web logs-db \
        migrate seed shell-db shell-api shell-web ps clean hooks test \
        up-db up-api up-web \
        dev-db dev-api dev-web \
        down-db down-api down-web

# ── Variables ─────────────────────────────────────────────────────
DC = docker compose

# ── Default ───────────────────────────────────────────────────────
help: ## Show available commands
	@echo ""
	@echo "  \033[1;34mHomeJira – Dev Commands\033[0m"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ── Lifecycle ─────────────────────────────────────────────────────
up: ## Start all services (detached, with hot reload)
	$(DC) up -d
	@echo ""
	@echo "  \033[1;32m✓ HomeJira is running!\033[0m"
	@echo "  Frontend  → http://localhost:3000"
	@echo "  API       → http://localhost:8080/api/v1"
	@echo "  Postgres  → localhost:5432"
	@echo ""

dev: ## Start all services in foreground (all logs visible)
	$(DC) up

down: ## Stop and remove containers
	$(DC) down

restart: ## Restart all services
	$(DC) restart

build: ## Rebuild images without cache
	$(DC) build --no-cache

clean: ## Stop containers and wipe volumes (resets DB)
	$(DC) down -v --remove-orphans
	@echo "  \033[1;31m✓ Containers and volumes removed\033[0m"

# ── Individual Services (detached) ────────────────────────────────
up-db: ## Start only the database
	$(DC) up -d db
	@echo ""
	@echo "  \033[1;32m✓ Postgres is running!\033[0m"
	@echo "  Postgres  → localhost:5432"
	@echo ""

up-api: ## Start only the database + API
	$(DC) up -d db api
	@echo ""
	@echo "  \033[1;32m✓ API is running!\033[0m"
	@echo "  API       → http://localhost:8080/api/v1"
	@echo "  Postgres  → localhost:5432"
	@echo ""

up-web: ## Start only the database + API + frontend
	$(DC) up -d db api web
	@echo ""
	@echo "  \033[1;32m✓ Frontend is running!\033[0m"
	@echo "  Frontend  → http://localhost:3000"
	@echo "  API       → http://localhost:8080/api/v1"
	@echo "  Postgres  → localhost:5432"
	@echo ""

# ── Individual Services (foreground) ──────────────────────────────
dev-db: ## Start only the database in foreground
	$(DC) up db

dev-api: ## Start only the database + API in foreground
	$(DC) up db api

dev-web: ## Start only the database + API + frontend in foreground
	$(DC) up db api web

# ── Individual Teardown ────────────────────────────────────────────
down-db: ## Stop only the database container
	$(DC) stop db

down-api: ## Stop only the API container
	$(DC) stop api

down-web: ## Stop only the frontend container
	$(DC) stop web

# ── Logs ──────────────────────────────────────────────────────────
logs: ## Tail logs for all services
	$(DC) logs -f

logs-api: ## Tail API server logs
	$(DC) logs -f api

logs-web: ## Tail frontend logs
	$(DC) logs -f web

logs-db: ## Tail database logs
	$(DC) logs -f db

# ── Database ──────────────────────────────────────────────────────
migrate: ## Run pending migrations (auto-runs on startup)
	$(DC) exec api ./migrate

seed: ## Seed database with sample household data
	$(DC) exec api ./seed

shell-db: ## Open interactive psql shell
	$(DC) exec db psql -U homejira -d homejira

# ── Container Shells ──────────────────────────────────────────────
shell-api: ## Open shell inside API container
	$(DC) exec api sh

shell-web: ## Open shell inside frontend container
	$(DC) exec web sh

# ── Hooks ─────────────────────────────────────────────────────────
hooks: ## Configure git to use project hooks in .githooks/
	git config core.hooksPath .githooks
	@echo "  Git hooks activated (.githooks/)"

# ── Status ────────────────────────────────────────────────────────
ps: ## List running containers and their status
	$(DC) ps

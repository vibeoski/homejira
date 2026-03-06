# 🏠 HomeJira

> Collaborative household task & grocery tracker — built with React, Go, and PostgreSQL.

---

## Tech Stack

| Layer      | Technology                          |
|-----------|--------------------------------------|
| Frontend  | React 18 + TypeScript + Vite (HMR)  |
| Backend   | Go 1.22 + Chi router                |
| Database  | PostgreSQL 16                        |
| Dev Infra | Docker Compose + Air (Go hot reload) |

---

## Prerequisites

Make sure these are installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Make](https://www.gnu.org/software/make/) — comes pre-installed on macOS/Linux; Windows users can use [GnuWin32](http://gnuwin32.sourceforge.net/packages/make.htm) or WSL

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/homejira.git
cd homejira

# 2. Start all services (builds images on first run)
make up

# 3. Seed the database with sample data
make seed
```

That's it. Open **http://localhost:3000** 🎉

---

## Available Commands

Run `make help` to see all commands:

```
  up                   Build and start all services (detached, with hot reload)
  dev                  Start all services in foreground (all logs visible)
  down                 Stop and remove containers
  restart              Restart all services
  build                Rebuild images without cache
  clean                Stop containers and wipe volumes (resets DB)

  logs                 Tail logs for all services
  logs-api             Tail API server logs
  logs-web             Tail frontend logs
  logs-db              Tail database logs

  migrate              Run pending migrations (auto-runs on startup)
  seed                 Seed database with sample household data
  shell-db             Open interactive psql shell

  shell-api            Open shell inside API container
  shell-web            Open shell inside frontend container

  ps                   List running containers and their status
```

---

## Service URLs

| Service   | URL                             |
|-----------|---------------------------------|
| Frontend  | http://localhost:3000           |
| API       | http://localhost:8080/api/v1    |
| Database  | localhost:5432                  |

---

## Hot Reload

Both services support hot reload out of the box:

- **Frontend** — Vite HMR. Save any `.tsx` / `.ts` / `.css` file and the browser updates instantly.
- **Backend** — [Air](https://github.com/air-verse/air) watches `.go` files and recompiles + restarts the server automatically.

---

## Project Structure

```
homejira/
├── Makefile                     # All dev commands
├── docker-compose.yml           # Service orchestration
│
├── backend/
│   ├── cmd/server/main.go       # Entry point, DI wiring, router setup
│   ├── config/                  # Environment configuration
│   ├── internal/
│   │   ├── domain/              # Pure business entities & repository interfaces
│   │   │   ├── task.go
│   │   │   ├── member.go
│   │   │   └── errors.go
│   │   ├── repository/          # Postgres implementations
│   │   │   ├── task_repo.go
│   │   │   └── member_repo.go
│   │   ├── service/             # Business logic (orchestrates repos)
│   │   │   ├── task_service.go
│   │   │   └── member_service.go
│   │   ├── handler/             # HTTP handlers (request/response)
│   │   │   ├── task_handler.go
│   │   │   ├── member_handler.go
│   │   │   └── respond.go
│   │   └── middleware/          # Request logger
│   ├── migrations/
│   │   ├── 001_init.sql         # Schema (auto-applied on startup)
│   │   └── seed.sql             # Sample data
│   ├── .air.toml                # Air hot reload config
│   ├── Dockerfile.dev
│   └── go.mod
│
└── frontend/
    ├── src/
    │   ├── api/                 # Axios API clients
    │   │   ├── client.ts
    │   │   ├── tasks.ts
    │   │   └── members.ts
    │   ├── components/
    │   │   ├── ui/              # Atomic: Avatar, Badge, Chip, Spinner
    │   │   ├── tasks/           # TaskCard, TaskDrawer, AddTaskSheet
    │   │   ├── stats/           # StatsScreen
    │   │   └── members/         # MembersScreen
    │   ├── store/               # Zustand global state
    │   ├── types/               # TypeScript interfaces + design constants
    │   ├── utils/               # timeAgo helper
    │   ├── App.tsx              # Root component, routing logic
    │   └── main.tsx             # React entry point
    ├── vite.config.ts
    ├── Dockerfile.dev
    └── package.json
```

---

## Architecture: Clean Layers

```
HTTP Request
     │
     ▼
┌──────────┐
│ Handler  │  — Parse request, validate input shape, call service
└────┬─────┘
     │
     ▼
┌──────────┐
│ Service  │  — Business rules, validation, orchestrate repos
└────┬─────┘
     │
     ▼
┌────────────┐
│ Repository │  — SQL queries, data mapping (implements Domain interface)
└────┬───────┘
     │
     ▼
┌──────────┐
│ Postgres │
└──────────┘
```

**Key principle:** each layer only depends on the layer below it through an interface defined in `domain/`. The domain package has zero external dependencies.

---

## API Reference

### Tasks

| Method | Endpoint                  | Description              |
|--------|--------------------------|--------------------------|
| GET    | `/api/v1/tasks`           | List tasks (filterable)  |
| POST   | `/api/v1/tasks`           | Create a task            |
| GET    | `/api/v1/tasks/:id`       | Get task with comments   |
| PATCH  | `/api/v1/tasks/:id`       | Update task (partial)    |
| DELETE | `/api/v1/tasks/:id`       | Delete task              |
| POST   | `/api/v1/tasks/:id/comments` | Add a comment         |

**Query params for GET /tasks:** `?category=grocery&done=false&search=milk`

### Members

| Method | Endpoint              | Description     |
|--------|-----------------------|-----------------|
| GET    | `/api/v1/members`     | List members    |
| POST   | `/api/v1/members`     | Create a member |
| GET    | `/api/v1/members/:id` | Get a member    |

### Example: Create Task

```bash
curl -X POST http://localhost:8080/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Buy coffee beans",
    "notes": "Colombian dark roast",
    "category": "grocery",
    "priority": "high",
    "assignee_id": "<existing-member-id>"
  }'
```

---

## Environment Variables

The defaults work out of the box with Docker Compose. To override, edit `docker-compose.yml`.

| Variable       | Default                                        | Description           |
|---------------|------------------------------------------------|-----------------------|
| DATABASE_URL  | postgres://homejira:homejira_secret@db:5432/... | Postgres connection   |
| PORT          | 8080                                           | API server port       |
| ENV           | development                                    | Environment name      |
| CORS_ORIGINS  | http://localhost:3000                          | Allowed CORS origins  |

---

## Roadmap

- [ ] Due dates + reminders
- [ ] Recurring tasks
- [ ] Shopping list mode (aggregate quantities)
- [ ] Real-time sync (SSE / WebSockets)
- [ ] Household invite via shareable link
- [ ] Dark mode
- [ ] PWA / native mobile app

---

## License

MIT

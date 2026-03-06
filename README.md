# HomeJira

> Jira for your home. Collaborative task manager for households — built with React, Go, and PostgreSQL.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite + Zustand          |
| Backend    | Go 1.24 + Chi router + PGX                      |
| Database   | PostgreSQL 16                                   |
| Realtime   | Server-Sent Events (SSE)                        |
| Dev Infra  | Docker Compose + Air (Go hot reload) + Vite HMR |

---

## Features

- **Auth** — phone number + 4-digit MPIN, JWT (7-day TTL), rate-limited login
- **Households** — create or join by code, invite by phone, admin controls (promote, remove, approve/reject requests)
- **Tasks** — full CRUD, category (grocery/chore/errand/repair), priority (urgent/high/normal), assignee, due date, notes
- **Live sync** — SSE streams push updates to all household members instantly, no polling
- **Activity history** — every task change (created, completed, assigned, priority/category/title/notes/due changed) recorded and shown in a unified timeline with comments
- **Stats** — completion ring, per-category progress bars, per-member breakdown
- **Guest mode** — try the app without an account (local storage only)
- **My tasks** — one-tap filter to see only tasks assigned to you

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/vibeoski/homejira.git
cd homejira

# 2. Start all services (builds images on first run)
make up

# 3. Seed with sample household data
make seed
```

Open **http://localhost:3000**

---

## Available Commands

```
make up          Start all services (detached, hot reload)
make dev         Start in foreground (all logs visible)
make down        Stop and remove containers
make clean       Stop containers + wipe volumes (resets DB)
make build       Rebuild images without cache

make logs        Tail all logs
make logs-api    Tail API logs
make logs-web    Tail frontend logs

make seed        Seed DB with sample data
make shell-db    Open psql shell
make shell-api   Open shell in API container
make shell-web   Open shell in frontend container
make ps          List running containers
```

---

## Service URLs

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| API       | http://localhost:8080/api/v1 |
| Database  | localhost:5432               |

---

## Project Structure

```
homejira/
├── Makefile
├── docker-compose.yml
├── BACKLOG.md
│
├── backend/
│   ├── cmd/server/main.go           # Entry point — connects DB, runs migrations, starts server
│   ├── cmd/seed/main.go             # DB seeder
│   ├── config/config.go             # Env config
│   └── internal/
│       ├── domain/                  # Entities + repository interfaces (no external deps)
│       │   ├── task.go
│       │   ├── member.go
│       │   ├── household.go
│       │   ├── activity.go
│       │   ├── auth.go
│       │   └── errors.go
│       ├── repository/              # PostgreSQL implementations
│       ├── service/                 # Business logic
│       ├── handler/                 # HTTP handlers
│       ├── middleware/              # Auth (JWT), logger, rate limiter
│       ├── sse/hub.go               # SSE pub/sub hub (household + member channels)
│       ├── server/server.go         # Router + dependency injection
│       └── db/migrations/           # golang-migrate SQL files (auto-applied on startup)
│
└── frontend/
    └── src/
        ├── api/                     # Axios clients (tasks, members, auth, households)
        ├── store/                   # Zustand (app state + authStore)
        ├── components/
        │   ├── ui/                  # Avatar, Badge, Chip, Spinner
        │   ├── layout/              # AppLayout, BottomNav, AccountMenu, GuestBanner
        │   ├── tasks/               # TaskCard, TaskDrawer, AddTaskSheet
        │   ├── members/             # MembersScreen, HouseholdPanel
        │   └── stats/               # StatsScreen
        ├── pages/                   # TasksPage, StatsPage, MembersPage, AuthPage
        ├── types/index.ts
        └── utils/index.ts
```

---

## Architecture

```
HTTP Request
     │
     ▼
┌──────────┐
│ Handler  │  Parse request, auth claims, call service
└────┬─────┘
     │
     ▼
┌──────────┐
│ Service  │  Business rules, validation, activity recording
└────┬─────┘
     │
     ▼
┌────────────┐
│ Repository │  SQL queries (implements Domain interface)
└────┬───────┘
     │
     ▼
┌──────────┐
│ Postgres │
└──────────┘
```

Each layer depends only on the layer below via interfaces defined in `domain/`. The domain package has zero external dependencies.

---

## API Reference

All endpoints require `Authorization: Bearer <jwt>` unless noted.

### Auth

| Method | Endpoint                | Auth | Description                        |
|--------|-------------------------|------|------------------------------------|
| POST   | `/auth/check-phone`     | No   | Check if phone is registered       |
| POST   | `/auth/login`           | No   | Login with phone + MPIN            |
| POST   | `/auth/register`        | No   | Register new account               |
| POST   | `/auth/refresh`         | Yes  | Reissue JWT with fresh DB state    |
| PATCH  | `/auth/mpin`            | Yes  | Change MPIN                        |

### Tasks

| Method | Endpoint                     | Description                              |
|--------|------------------------------|------------------------------------------|
| GET    | `/tasks`                     | List tasks (`?category=&done=&search=`)  |
| POST   | `/tasks`                     | Create task                              |
| GET    | `/tasks/:id`                 | Get task with comments                   |
| PATCH  | `/tasks/:id`                 | Update task (partial)                    |
| DELETE | `/tasks/:id`                 | Delete task                              |
| POST   | `/tasks/:id/comments`        | Add comment                              |
| GET    | `/tasks/:id/activity`        | Get activity history                     |

### Members

| Method | Endpoint          | Description              |
|--------|-------------------|--------------------------|
| GET    | `/members`        | List household members   |
| GET    | `/members/:id`    | Get member               |
| PATCH  | `/members/me`     | Update profile           |

### Households

| Method | Endpoint                          | Description                      |
|--------|-----------------------------------|----------------------------------|
| GET    | `/households/me`                  | Get current household            |
| POST   | `/households`                     | Create household                 |
| POST   | `/households/join-by-code`        | Submit join request              |
| POST   | `/households/leave`               | Leave household                  |
| POST   | `/households/members/:id/remove`  | Remove member (admin)            |
| POST   | `/households/members/:id/promote` | Promote to admin                 |
| GET    | `/households/requests`            | List pending join requests       |
| POST   | `/households/requests/:id/approve`| Approve join request             |
| POST   | `/households/requests/:id/reject` | Reject join request              |
| POST   | `/households/invites`             | Invite by phone                  |
| POST   | `/households/invites/:id/accept`  | Accept invite                    |

### Realtime

| Method | Endpoint              | Auth        | Description              |
|--------|-----------------------|-------------|--------------------------|
| GET    | `/events?token=<jwt>` | Query param | SSE stream for household |

---

## Environment Variables

| Variable       | Default                                           | Description              |
|----------------|---------------------------------------------------|--------------------------|
| `DATABASE_URL` | `postgres://homejira:homejira_secret@db:5432/...` | Postgres connection      |
| `PORT`         | `8080`                                            | API server port          |
| `JWT_SECRET`   | `dev-secret-change-in-prod`                       | JWT signing key          |
| `CORS_ORIGINS` | `http://localhost:3000`                           | Allowed CORS origins     |
| `ENV`          | `development`                                     | Environment name         |

---

## Roadmap

See [BACKLOG.md](./BACKLOG.md) for the full prioritised backlog.

**MVP next:**
- Due date reminders (push notifications)
- Recurring tasks
- Shopping list aggregation

---

## License

MIT

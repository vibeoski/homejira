# HomeJira

> Jira for your home. Collaborative task manager for households — built with React, Go, and PostgreSQL.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19 + TypeScript + Vite + React Router + Zustand |
| Backend    | Go 1.24 + Chi router + PGX                      |
| Database   | PostgreSQL 16                                   |
| Realtime   | Server-Sent Events (SSE)                        |
| Dev Infra  | Docker Compose + Air (Go hot reload) + Vite HMR |

---

## Features

- **Auth** — username + 4-digit mPIN, JWT (7-day TTL), rate-limited login, change PIN in-app
- **Households** — create or join by code; invite by share link; admin controls (promote, remove, approve/reject join requests); leave household; delete group
- **Tasks** — full CRUD, category (chore/errand/repair), priority (urgent/high/normal), assignee, due date, notes, search and filter
- **Grocery list** — dedicated checklist view with quick-add, quantity field, check-all, clear done, and history grouped by day
- **Live sync** — SSE streams push updates to all household members instantly, no polling
- **Activity history** — every task change (created, completed, assigned, priority/category/title/notes/due changed) recorded in a unified timeline alongside comments
- **Stats** — completion ring, per-category progress bars, per-member breakdown
- **Coins & referral** — earn coins for referring friends (+10) and for household members joining via your invite link (+20); coin balance and history in account menu
- **Feature flags** — public config endpoint lets the frontend enable or hide features safely
- **My tasks filter** — one-tap to see only tasks assigned to you

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

### Local (dev)

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| API       | http://localhost:8080/api/v1 |
| Database  | localhost:5432               |

### Staging

| Service   | URL                                                             |
|-----------|-----------------------------------------------------------------|
| Frontend  | https://homejira-git-staging-vibeoskis-projects.vercel.app     |
| API       | https://homejira-staging.up.railway.app/api/v1                 |

### Production

| Service   | URL                                        |
|-----------|--------------------------------------------|
| Frontend  | https://homejira.app                       |
| API       | https://homejira.up.railway.app/api/v1     |

---

## Design & API Tooling

### Postman Collection

A complete Postman collection covering the current API surface lives at [`postman/HomeJira.postman_collection.json`](./postman/HomeJira.postman_collection.json).

- Import the JSON file into Postman for the fully folder-organised version
- Collection variables: `{{baseUrl}}`, `{{token}}` (auto-set by Login/Register), `{{taskId}}`, `{{memberId}}`, `{{linkToken}}`
- Test scripts auto-save key IDs after each create request
- Collection metadata (UID, workspace) at [`postman/postman.json`](./postman/postman.json)

> A git pre-commit hook blocks commits where handler or router files change but the collection JSON was not also staged — keeping the collection in sync automatically.

### FigJam Diagrams

All diagrams are hosted in FigJam. Claim the links below to add them to your workspace.

| Diagram | Type | Link |
|---------|------|------|
| System Architecture | Architecture | [Open in FigJam](https://www.figma.com/online-whiteboard/create-diagram/f425fc6a-796f-49f6-b8b9-d2adc37ff04f) |
| Auth Flow | User flow | [Open in FigJam](https://www.figma.com/online-whiteboard/create-diagram/f326dd42-b9dc-41dc-99a5-900867f996be) |
| Task Lifecycle Flow | User flow | [Open in FigJam](https://www.figma.com/online-whiteboard/create-diagram/56504635-14af-4a8f-967a-0155b16398f4) |
| Household Membership Flow | User flow | [Open in FigJam](https://www.figma.com/online-whiteboard/create-diagram/1d54d21c-096b-4ea5-94e6-1f5b1316a4bb) |
| TasksPage + TaskDrawer Layout | Screen wireframe | [Open in FigJam](https://www.figma.com/online-whiteboard/create-diagram/f35af8f5-7685-47cb-bef8-3ee4b2c41f08) |
| Auth Screens Layout | Screen wireframe | [Open in FigJam](https://www.figma.com/online-whiteboard/create-diagram/0b61dea7-7a3d-4882-94b4-82c08a8d32fa) |

---

## Project Structure

```
homejira/
├── Makefile
├── docker-compose.yml
├── postman/
│   ├── HomeJira.postman_collection.json  # Postman collection v2.1 (source of truth)
│   └── postman.json                      # Collection UID + workspace metadata
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
│       │   ├── coins.go
│       │   ├── activity.go
│       │   ├── auth.go
│       │   └── errors.go
│       ├── repository/              # PostgreSQL implementations
│       ├── service/                 # Business logic + tests
│       ├── handler/                 # HTTP handlers
│       ├── middleware/              # Auth (JWT), logger, rate limiter
│       ├── sse/hub.go               # SSE pub/sub hub (household + member channels)
│       ├── server/server.go         # Router + dependency injection
│       └── db/migrations/           # golang-migrate SQL files (auto-applied on startup)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx                 # React entry point
        ├── App.tsx                  # Router + auth guards
        ├── api/                     # Axios client + endpoint wrappers
        ├── store/                   # Zustand stores (app, auth, config, guest helpers)
        ├── components/
        │   ├── ui/                  # Reusable UI bits (Spinner, Avatar, AppLogo, etc.)
        │   ├── layout/              # AppLayout, BottomNav, AccountMenu
        │   ├── tasks/               # TaskCard, TaskDrawer, AddTaskSheet, AddGrocerySheet
        │   ├── members/             # MembersScreen, HouseholdPanel, HouseholdPromo
        │   ├── auth/                # LoginFlow, RegisterFlow
        │   └── stats/               # StatsScreen
        ├── pages/                   # Auth, join/referral landing, tasks, grocery, stats, household
        ├── index.css                # Global styles
        ├── types/index.ts
        └── utils/index.ts
```

---

## Architecture

HomeJira is a small full-stack app with a clear split between a Go API and a React SPA:

- The backend composition root is `backend/cmd/server/main.go` + `backend/internal/server/server.go`: load config, connect DB, run embedded migrations, create repositories, create services, then mount handlers and middleware.
- The frontend composition root is `frontend/src/main.tsx` + `frontend/src/App.tsx`: boot React, fetch config, guard routes based on auth state, and render the app shell.
- Development runtime is `db` + `api` + `web`, started together with Docker Compose. Vite proxies `/api` to the Go container in local dev.

### Backend layering

```
HTTP request
    │
    ▼
Handler      HTTP parsing, auth claims, response mapping
    │
    ▼
Service      Business rules, validation, permissions, workflow orchestration
    │
    ▼
Repository   PGX/Postgres queries and row mapping
    │
    ▼
PostgreSQL
```

- `internal/domain/` defines entities plus repository interfaces. This is the backend's stable core and has no framework-specific responsibilities.
- `internal/repository/` implements those interfaces with PGX and owns SQL, joins, and scan helpers.
- `internal/service/` holds the real application logic: auth, household membership, tasks, groceries, coins, referrals, and activity history.
- `internal/handler/` is intentionally thin: decode request, call service, encode response, trigger SSE notifications after successful mutations.

### Frontend flow

```
Page / component
    │
    ▼
Zustand store action
    │
    ▼
Axios API client
    │
    ▼
Go API
```

- `frontend/src/components/layout/AppLayout.tsx` owns the authenticated shell and the `EventSource` connection.
- `frontend/src/store/index.ts` is the main app store for tasks, groceries, members, loading state, and optimistic updates.
- `frontend/src/store/authStore.ts` keeps JWT + member state in localStorage so refreshes do not flash back to auth.
- `frontend/src/api/client.ts` centralizes the base URL, attaches the bearer token, and redirects to `/auth` on 401s.

### Realtime model

- The backend uses a lightweight in-memory SSE hub keyed by household and, for pending join flows, by member.
- Mutation handlers call `hub.Notify(...)` after writes.
- The frontend listens for SSE messages and refetches the affected datasets rather than trying to merge low-level patches client-side.

---

## API Reference

All endpoints require `Authorization: Bearer <jwt>` unless noted.

### Auth

| Method | Endpoint                | Auth | Description                        |
|--------|-------------------------|------|------------------------------------|
| POST   | `/auth/check-username`  | No   | Check if username is registered    |
| POST   | `/auth/login`           | No   | Login with username + mPIN         |
| POST   | `/auth/register`        | No   | Register new account               |
| POST   | `/auth/refresh`         | Yes  | Reissue JWT with fresh DB state    |
| PATCH  | `/auth/mpin`            | Yes  | Change mPIN                        |

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

### Health

| Method | Endpoint   | Auth | Description                                      |
|--------|------------|------|--------------------------------------------------|
| GET    | `/health`  | No   | Liveness check — commit SHA, env, DB ping, uptime |

### Members

| Method | Endpoint                    | Description                     |
|--------|-----------------------------|---------------------------------|
| GET    | `/members`                  | List household members          |
| GET    | `/members/:id`              | Get member                      |
| PATCH  | `/members/me`               | Update profile                  |
| GET    | `/members/me/coins`         | Get coin balance + history      |
| GET    | `/members/me/referral-link` | Get or create referral link     |

### Households

| Method | Endpoint                           | Description                      |
|--------|------------------------------------|----------------------------------|
| GET    | `/households/me`                   | Get current household            |
| POST   | `/households`                      | Create household                 |
| DELETE | `/households`                      | Delete household (admin only)    |
| POST   | `/households/join-by-code`         | Submit join request via code     |
| POST   | `/households/leave`                | Leave household                  |
| POST   | `/households/members/:id/remove`   | Remove member (admin)            |
| POST   | `/households/members/:id/promote`  | Promote to admin                 |
| GET    | `/households/requests`             | List pending join requests       |
| GET    | `/households/requests/mine`        | Get own pending join request     |
| POST   | `/households/requests/:id/approve` | Approve join request (admin)     |
| POST   | `/households/requests/:id/reject`  | Reject join request (admin)      |
| POST   | `/households/requests/:id/cancel`  | Cancel own join request          |
| POST   | `/households/invites`              | Send direct invite (admin)       |
| GET    | `/households/invites/me`           | Get pending invites for current user |
| POST   | `/households/invites/:id/accept`   | Accept a household invite        |
| POST   | `/households/invites/:id/reject`   | Reject a household invite        |
| POST   | `/households/invite-link`          | Generate shareable invite link (admin) |
| GET    | `/households/link/:token`          | Resolve invite link (public)     |
| POST   | `/households/link/:token/join`     | Join via invite link             |

### Config

| Method | Endpoint   | Auth | Description                  |
|--------|------------|------|------------------------------|
| GET    | `/config`  | No   | Get all feature flags        |

### Referral

| Method | Endpoint           | Auth | Description                        |
|--------|--------------------|------|------------------------------------|
| GET    | `/referral/:token` | No   | Get referrer info for landing page |

### Realtime

| Method | Endpoint              | Auth        | Description              |
|--------|-----------------------|-------------|--------------------------|
| GET    | `/events?token=<jwt>` | Query param | SSE stream for household/member updates |

---

## Environment Variables

### Backend

| Variable       | Default                                                          | Description                        |
|----------------|------------------------------------------------------------------|------------------------------------|
| `DATABASE_URL` | `postgres://homejira:homejira_secret@localhost:5432/homejira?...` | Postgres connection string         |
| `PORT`         | `8080`                                                           | API server port                    |
| `ENV`          | `development`                                                    | Environment name                   |
| `CORS_ORIGINS` | `http://localhost:3000`                                          | Comma-separated allowed origins    |
| `JWT_SECRET`   | `CHANGE_ME_IN_PRODUCTION_32_CHARS!`                              | JWT signing key                    |
| `APP_BASE_URL` | `http://localhost:3000`                                          | Base URL used when building links  |

### Frontend

| Variable       | Default   | Description                                 |
|----------------|-----------|---------------------------------------------|
| `VITE_API_URL` | `/api/v1` | API base URL; Vite proxy handles this in dev |

---

## Roadmap

GitHub Issues are the source of truth for active backlog and roadmap work:

- Open issues: <https://github.com/vibeoski/homejira/issues>
- Roadmap issues: <https://github.com/vibeoski/homejira/issues?q=is%3Aissue+is%3Aopen+label%3Aroadmap>
- Necessary issues: <https://github.com/vibeoski/homejira/issues?q=is%3Aissue+is%3Aopen+label%3Anecessary>
- Blockers: <https://github.com/vibeoski/homejira/issues?q=is%3Aissue+is%3Aopen+label%3Ablocker>

**Open bugs (Sprint 5):**
- #70 JoinPage: authenticated auto-join does not refresh JWT (stale household_id)
- #71 JoinPage: "Sign in" button calls sign-up handler
- #72 AccountMenu: avatar shows emoji instead of letter
- #73 TasksPage: heading not using Fraunces font
- #74 TasksPage: undo toast uses orange (palette violation)
- #75 AddTaskSheet: empty household_id fallback on task create
- #76 Loading state not shown on SSE-triggered refresh
- #77 UX polish audit follow-up

**Up next (roadmap):**
- #42 In-app notification feed (NE-08)
- #44 Recurring tasks (NE-10)
- #48 Push notifications (Web Push API)
- #45 PWA — installable, offline

---

## License

MIT

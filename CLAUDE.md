# CLAUDE.md — HomeJira Codebase Guide

Authoritative reference for how code is written. Read before adding any feature, endpoint, or component.

---

## Git Workflow

```
main (production)
└── feature/* or fix/* (work branches)
```

1. Branch off `main`: `git checkout main && git pull && git checkout -b feature/my-thing`
2. Verify locally (`make up`) before opening a PR
3. PR targets `main` — CI must pass; merge with `gh pr merge --merge`

**Rules:** Never commit directly to `main`.

---

## Project Overview

HomeJira — household task management ("Jira for home"). Go backend + TypeScript frontend.
Members belong to a **Household**. Tasks are scoped to a household.
Auth: username + 4-digit mPIN → JWT (7-day TTL). Guest mode: localStorage only, no API calls.

**Service URLs**
| Env | Frontend | API |
|-----|----------|-----|
| Dev | http://localhost:3000 | http://localhost:8080/api/v1 |
| Staging | — | https://homejira-staging.up.railway.app/api/v1 |
| Production | https://homejira.app | https://homejira.up.railway.app/api/v1 |

**Dev commands:** `make up` · `make down` · `make seed` · `make clean` · `make shell-db` · `make logs-api`

---

## Repository Layout

```
homejira/
├── backend/
│   ├── cmd/server/main.go          # entry point
│   ├── cmd/seed/main.go            # DB seeder
│   ├── config/config.go            # env-backed Config struct
│   └── internal/
│       ├── domain/                 # entities, interfaces, sentinel errors
│       ├── repository/             # pgx SQL implementations
│       ├── service/                # business logic
│       ├── handler/                # HTTP handlers + respond helpers
│       ├── middleware/             # auth JWT, logger, rate limiter
│       ├── sse/hub.go              # SSE pub/sub hub
│       ├── server/server.go        # DI wiring + chi router
│       └── db/migrations/          # 000001–000018 SQL migration files
└── frontend/src/
    ├── api/                        # client.ts, tasks.ts, members.ts, households.ts, auth.ts, coins.ts, groceries.ts
    ├── store/                      # index.ts (app), authStore.ts (auth), configStore.ts (feature flags), guest.ts
    ├── hooks/                      # useBreakpoint.ts + others
    ├── components/                 # ui/, layout/, tasks/, members/, stats/, auth/
    ├── pages/                      # TasksPage, StatsPage, MembersPage, GroceryPage, AuthPage, ReferralPage
    ├── types/index.ts              # all TS interfaces and enum-like const maps
    └── utils/index.ts              # pure utility functions
```

---

## Backend Architecture

### Layer Rules (strict)

```
domain  <-- repository  <-- service  <-- handler
```

- **domain**: pure Go structs, interfaces, sentinel errors. Zero imports from other internal packages.
- **repository**: implements domain interfaces using `pgxpool`. Raw SQL only. No business logic.
- **service**: imports domain interfaces. Validates input, enforces business rules.
- **handler**: calls service, reads context/body, writes JSON. No direct DB access.
- **server.go**: only place where concrete types are wired (DI).

### New Feature Checklist (backend)

1. Add entity + repository interface to `internal/domain/`
2. Add sentinel errors to `domain/errors.go` if needed
3. Implement repository in `internal/repository/thing_repo.go`
4. Add service in `internal/service/thing_service.go`
5. Add handler in `internal/handler/thing_handler.go`
6. Wire in `internal/server/server.go`
7. Register routes in `r.Route("/api/v1", ...)` block
8. Write migration if schema changes

### Domain Conventions

```go
type Category string
const ( CategoryChore Category = "chore" ... ) // grocery is NOT a task category

type TaskStatus = "open" | "in_progress" | "on_hold" | "done"

type Task struct {
    ID       uuid.UUID  `json:"id"`
    Status   string     `json:"status"`
    Assignee *Member    `json:"assignee,omitempty"` // populated from JOIN
}

type UpdateTaskInput struct {
    Title *string `json:"title,omitempty"` // all update fields are pointers
}

type TaskFilter struct { HouseholdID *uuid.UUID; Category *Category; Status *string; Done *bool; Search string }

type TaskRepository interface {
    FindAll(filter TaskFilter) ([]Task, error)
    FindByID(id uuid.UUID) (*Task, error)
    Create(input CreateTaskInput) (*Task, error)
    Update(id uuid.UUID, input UpdateTaskInput) (*Task, error)
    Delete(id uuid.UUID) error
    AddComment(taskID uuid.UUID, authorID uuid.UUID, body string) (*Comment, error)
}
```

**Sentinel errors** (`domain/errors.go`): `ErrNotFound`, `ErrInvalidInput`, `ErrAlreadyExists`, `ErrUnauthorized`, `ErrWrongMpin`.
Wrap with: `fmt.Errorf("%w: detail", domain.ErrXxx)`.

### Repository Conventions

- Unexported struct (`type taskRepo struct`), constructor returns the interface.
- Always `context.Background()` for DB calls.
- Map `pgx.ErrNoRows` → `domain.ErrNotFound`; Postgres `"23505"` → `domain.ErrAlreadyExists`.
- Use `RETURNING *` after INSERT/UPDATE. Use CTE pattern when joined data needed from a write.
- Define column constants for repeated SELECT lists (e.g. `taskSelectCols`).
- Always `defer rows.Close()`. Always `rows.Err()` after loop.
- NULL-able TEXT columns: `COALESCE(col, '')` in every scan — never scan nullable TEXT into non-pointer `string`.
- Dynamic WHERE/SET: `[]string{"1=1"}`+`[]any{}` with `i := 1` counter for `$N` placeholders.

### Service Conventions

- Constructor: `func NewXxxService(repo domain.XxxRepository, ...) *XxxService`
- Validate all input before calling repo. Authorization checks (role, household) live here.
- Method names: `ListXxx`, `GetXxx`, `CreateXxx`, `UpdateXxx`, `DeleteXxx`.

### Handler Conventions

```go
respond(w, http.StatusOK, envelope{"task": task})
respondError(w, err)          // auto-maps domain errors → HTTP status
respond(w, http.StatusNoContent, nil)  // 204 for deletes
```

**Error mapping:** `ErrNotFound`→404, `ErrInvalidInput`→422, `ErrUnauthorized`→401, `ErrAlreadyExists`→409, other→500.

- Extract claims: `middleware.ClaimsFromContext(r.Context())` — always check `ok`.
- Parse UUIDs from URL params at handler level. Decode body with `decode(r, &body)`.
- Envelope keys: singular (`"task"`) for single resource, plural (`"tasks"`) for collections.
- Comment above each handler: `// GET /tasks/{id}`.

### Middleware / Auth

- `middleware.RequireAuth(authSvc)` — validates Bearer JWT, injects `*domain.Claims` into context.
- Claims: `MemberID`, `Username`, `Name`, `Avatar`, `Color`, `HouseholdID` (empty string if none).
- All routes except `/auth/*` are inside the `RequireAuth` group.
- JWT TTL 7 days. `household_id` embedded in token.

### Config

- All config from env via `config.Load()`. Fields: `DatabaseURL`, `Port`, `Env`, `CORSOrigins`, `JWTSecret`.
- Never `os.Getenv` outside `config/config.go`.

### SSE

- `internal/sse/hub.go` — pub/sub hub; household + member-level channels.
- SSE middleware wrappers must implement `http.Flusher` — otherwise returns 500.
- Server `WriteTimeout=0` for SSE endpoints.

---

## Database Migrations

**Naming:** `NNNNNN_short_description.up.sql` / `.down.sql` (zero-padded 6-digit, lowercase underscores).
Every `.up.sql` has a paired `.down.sql`. Migrations embedded at compile time via `//go:embed`.
Latest migration: **000018** (`add_task_status`).

**SQL Style:**
- Identifiers: `snake_case`. PKs: `UUID DEFAULT gen_random_uuid()`. Strings: `TEXT`. Timestamps: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- FKs: always explicit `ON DELETE` (`CASCADE`/`RESTRICT`/`SET NULL`).
- Enums: `TEXT NOT NULL CHECK (col IN (...))` — no Postgres ENUM types.
- Indexes: `CREATE INDEX IF NOT EXISTS idx_<table>_<column>` on FK cols, WHERE cols, status cols.
- Always use `IF NOT EXISTS` / `IF EXISTS` guards.

**Rules:** Never modify existing migrations. One concern per migration. Add comment at top.

### Current Schema (key tables)

- `members`: id, name, avatar, color, **username** (nullable TEXT → COALESCE), mpin_hash, household_id (FK nullable), role, created_at
- `tasks`: id, title, notes, category (`chore|errand|repair`), priority (`urgent|high|normal`), **status** (`open|in_progress|on_hold|done`), assignee_id (FK nullable), household_id (FK), done, done_at, due_at, quantity (nullable TEXT), created_at, updated_at
- `groceries`: id, title, quantity (nullable TEXT), notes, done, done_at, household_id (FK), assignee_id (FK nullable), created_at, updated_at
- `comments`: id, task_id (FK), author_id (FK), body, created_at
- `task_activities`: id, task_id (FK), actor_id (FK nullable), kind, meta (JSONB), created_at
- `households`: id, name, kind (`home|group`), join_code, created_at
- `coin_transactions`: id, member_id (FK), amount, reason, meta (JSONB), created_at
- `referral_links`: id, member_id (FK), token, created_at
- `feature_flags`: key, enabled, created_at

---

## API Routes

```
GET    /health                                    (public)
GET    /api/v1/config                             (public — feature flags)
GET    /api/v1/events?token=<jwt>                 (SSE stream)
GET    /api/v1/households/link/{token}            (public)
GET    /api/v1/referral/{token}                   (public)

POST   /api/v1/auth/check-phone
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh                       (protected)
PATCH  /api/v1/auth/mpin                          (protected)

GET    /api/v1/members/                           (protected)
GET    /api/v1/members/{id}                       (protected)
PATCH  /api/v1/members/me                         (protected)
GET    /api/v1/members/me/coins                   (protected)
GET    /api/v1/members/me/referral-link           (protected)

GET/POST       /api/v1/tasks/                     (protected)
GET/PATCH/DEL  /api/v1/tasks/{id}                 (protected)
POST           /api/v1/tasks/{id}/comments        (protected)
GET            /api/v1/tasks/{id}/activity        (protected)

GET/POST       /api/v1/groceries/                 (protected)
GET/PATCH/DEL  /api/v1/groceries/{id}             (protected)

GET    /api/v1/households/me                      (protected)
POST   /api/v1/households/                        (protected — kind: "home"|"group")
POST   /api/v1/households/join-by-code            (protected)
POST   /api/v1/households/invite-link             (protected admin)
POST   /api/v1/households/link/{token}/join       (protected)
POST   /api/v1/households/leave                   (protected)
DELETE /api/v1/households/                        (protected admin)
POST   /api/v1/households/members/{id}/remove     (protected admin)
POST   /api/v1/households/members/{id}/promote    (protected admin)
GET    /api/v1/households/requests                (protected admin)
GET    /api/v1/households/requests/mine           (protected)
POST   /api/v1/households/requests/{id}/approve|reject|cancel
POST   /api/v1/households/invites                 (protected admin)
GET    /api/v1/households/invites/me              (protected)
POST   /api/v1/households/invites/{id}/accept|reject
```

**Note:** `POST /api/v1/members` does NOT exist. Member creation is via `POST /auth/register` only.

---

## Frontend Architecture

### Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `useAuthStore` | `store/authStore.ts` | JWT token, member profile, guest mode, localStorage |
| `useStore` | `store/index.ts` | tasks, members, filters, loading/error state |
| `useConfigStore` | `store/configStore.ts` | feature flags from `/api/v1/config` |

- Auth store initialized from `localStorage` at module load (prevents auth flash).
- localStorage keys: `hj_token`, `hj_member`, `hj_guest`, `hj_guest_tasks`.
- Optimistic updates: apply immediately, revert on error.

### API Layer

- All HTTP via `api/client.ts` (axios, base URL `/api/v1`).
- Request interceptor: attaches `Authorization: Bearer <token>`.
- Response interceptor: on 401, clears credentials + redirects to `/auth`.
- Named export per resource: `export const tasksApi = { list, get, create, update, remove, addComment }`.
- Functions return unwrapped resource: `return data.task`. Never call `axios` directly.

### Types

All shared TS types in `src/types/index.ts`. Household-specific types (`Household`, `JoinRequest`, `HouseholdInvite`) live in `api/households.ts`.

Key types:
```ts
type TaskStatus = 'open' | 'in_progress' | 'on_hold' | 'done'
// STATUSES map: { label, color } for each status
// Task categories: 'chore' | 'errand' | 'repair'  (NOT grocery — groceries are separate)
```

### Component Conventions

- Named exports only: `export function TaskCard(...)`. Props interface named `Props` (local).
- Inline styles only. Warm neutral palette:
  - Background `#faf7f2` · Border `#ede8e1` · Text `#1c1917` · Secondary `#78716c` · Muted `#a8a29e`
  - Primary interactive: `#6366f1` (indigo) · Active bg: `#eef2ff`
  - Orange `#f97316`: Chore/High priority data only — not interactive chrome
  - Error: `#ef4444` text / `#fecaca` border · Warning: `#d97706` text / `#fde68a` border / `#fffbeb` bg
- Border radius: `8–10px` small · `12–14px` cards/inputs · `20–24px` panels · `99px` pills.
- Font: `Fraunces, serif` headings, system sans-serif body. Transitions: `all .15s`.
- `slide-up` is the only CSS animation class.

### Routing

```
/auth → AuthPage (public)   / → TasksPage   /stats → StatsPage   /household → MembersPage
```
`canAccessApp = isAuthenticated || isGuest`. `AppLayout`: max-width 520px, `BottomNav`, optional `GuestBanner`.

### Guest Mode

`isGuest` skips login. Every store action checks `useAuthStore.getState().isGuest` and branches to localStorage or skips. `GUEST_MEMBER` is the synthetic assignee.

---

## Naming Conventions

**Go:** packages lowercase (`domain`), files `snake_case`, exported types `PascalCase`, repo structs camelCase (`taskRepo`), constructors `New<Type>`, repo methods `FindAll/FindByID/Create/Update/Delete`, service methods `ListXxx/GetXxx/CreateXxx`, handlers match HTTP (`List/Get/Create/Update/Delete`).

**SQL:** tables `snake_case` plural, columns `snake_case`, indexes `idx_<table>_<column>`, constraints `fk_<table>_<ref>`.

**TypeScript:** component files `PascalCase.tsx`, others `camelCase.ts`; components named export `PascalCase`; stores `useXxx`; API modules `xxxApi`; types `PascalCase`; store actions camelCase verbs.

---

## Security Rules

- `MpinHash` tagged `json:"-"` — never serialized. `username` tagged `json:"username,omitempty"`.
- mPINs hashed with `bcrypt.DefaultCost`. Never log raw PINs.
- All SQL uses parameterized queries. Never concatenate user input.
- JWT secret from env (`cfg.JWTSecret`).
- Household authorization (role, membership) enforced in service layer — never trust client-supplied household IDs.
- Tasks filtered by `household_id` from JWT claims, not query params.

---

## Critical Bugs (do not re-introduce)

- `COALESCE(username, '')` required in ALL member SELECT/RETURNING — legacy members may have username=NULL, causes pgx scan panic on non-pointer string.
- `POST /members` is removed — member creation is auth-only via `/auth/register`.
- Firebase/OTP phone verification was trialled and fully removed — do not re-introduce.
- `phone` column was renamed to `username` in migration 000016 — never reference `phone` in new queries.
- Groceries are a **separate table/resource** (migration 000017) — NOT a task category. Task categories = `chore|errand|repair` only.

---

## Rules Claude Must Follow

1. **Never bypass layer boundary.** Handlers → service only. No repo calls from handlers. No handler calls from services.

2. **New domain errors in `domain/errors.go`.** Wrap: `fmt.Errorf("%w: detail", domain.ErrXxx)`. No ad-hoc `errors.New(...)` elsewhere.

3. **New routes in `server.go` only.** Inside `r.Route("/api/v1", ...)`. Protected routes inside `RequireAuth` group.

4. **Repository constructor returns domain interface.** `func NewXxxRepository(db *pgxpool.Pool) domain.XxxRepository`.

5. **Service constructor takes domain interfaces.** `func NewXxxService(repo domain.XxxRepository, ...) *XxxService`.

6. **Every new DB table/column needs a migration.** Create both `.up.sql` and `.down.sql`. Never modify existing migrations.

7. **All migrations use `IF NOT EXISTS`/`IF EXISTS` guards.** All FK columns have `ON DELETE`. Indexed columns used in WHERE.

8. **No raw SQL in services or handlers.** SQL lives only in repository files.

9. **Response envelopes use consistent keys.** Singular (`"task"`) for single, plural (`"tasks"`) for collections. Deletes → `204 No Content`.

10. **HTTP errors use `respondError(w, err)`.** Only use `respond(w, http.StatusBadRequest, ...)` for pre-service input parsing errors.

11. **Frontend: no direct axios calls.** All HTTP through api modules.

12. **Frontend: shared types in `src/types/index.ts`.** API-only shapes may live in the api file.

13. **Frontend: every store action handles guest mode.** Check `useAuthStore.getState().isGuest` — localStorage or skip.

14. **Frontend: inline styles only.** No CSS files, CSS-in-JS, or utility frameworks.

15. **Frontend: components are named exports.** Never default export components.

16. **No ORM or query builder.** Raw SQL + parameterized queries only.

17. **No new packages without discussion.** Dependency set is intentionally minimal.

18. **Nullable TEXT columns scanned into Go `string` must use `COALESCE(col, '')`.** Apply to every SELECT/RETURNING query for that column, not just new ones.

19. **Run QA automation scripts in the background to avoid token bloat.** When executing test or smoke-test scripts, use the Bash tool with `run_in_background: true`. Only read output via `TaskOutput` if the script fails or the user asks for results.

---

## Preferences

- When asked to create multiple deliverables (e.g., diagrams, docs, collections), create ALL of them without asking.

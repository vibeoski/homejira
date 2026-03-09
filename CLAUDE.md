# CLAUDE.md — HomeJira Codebase Guide

This file is the authoritative reference for how code is written in this project.
Read it before adding any new feature, endpoint, or component.

---

## Git Workflow

**Branch strategy:**
```
main (production)
└── staging (staging environment)
    └── feature/* or fix/* (your work branches)
```

**For every feature or bug fix:**
1. Branch off `staging`: `git checkout staging && git pull && git checkout -b feature/my-thing`
2. Build and verify locally (`make up`) on the feature branch before opening a PR
3. Open PR targeting `staging` (never directly to `main`)
4. CI must pass on the PR
5. Verify the deployed preview in the staging environment (Railway staging + Vercel preview)
6. Only then merge staging → main via PR to promote to production

**Merge strategy (critical — prevents conflicts):**
- `feature/* → staging`: **squash merge** (`gh pr merge --squash`) — condenses noisy commits
- `staging → main`: **regular merge** (`gh pr merge --merge`) — preserves exact SHAs so git never sees staging commits as new relative to main. Using squash here causes divergence and conflicts on every subsequent promotion.

**Rules:**
- Never commit directly to `main` or `staging`
- **All PRs from feature/fix branches MUST target `staging`**, never `main`
- `main` only ever receives PRs from `staging` (promotion PRs)
- Always verify locally first, then in staging, before promoting staging → main

---

## Project Overview

HomeJira is a household task management app (Jira for home).
Members belong to a **Household**. Tasks are scoped to a household.
Auth is phone + 4-digit mPIN → JWT. Guest mode is supported (localStorage only, no API calls).

**Service URLs (dev)**
- Frontend: http://localhost:3000
- API: http://localhost:8080/api/v1

**Service URLs (staging)**
- Frontend: https://homejira-git-staging-vibeoskis-projects.vercel.app
- API: https://homejira-staging.up.railway.app/api/v1

**Service URLs (production)**
- Frontend: https://homejira.app
- API: https://homejira.up.railway.app/api/v1

**Dev commands**
```
make up          # build + start all Docker services
make down        # stop containers
make seed        # seed DB with sample data
make clean       # wipe containers + volumes (resets DB)
make shell-db    # psql into Postgres
make logs-api    # tail API logs
```

---

## Repository Layout

```
homejira/
├── Makefile
├── backend/
│   ├── cmd/server/main.go          # entry point: config -> db -> server.Start()
│   ├── cmd/seed/main.go            # DB seeder
│   ├── config/config.go            # env-backed Config struct
│   └── internal/
│       ├── domain/                 # entities, repository interfaces, sentinel errors
│       ├── repository/             # pgx SQL implementations
│       ├── service/                # business logic
│       ├── handler/                # HTTP handlers + respond helpers
│       ├── middleware/             # auth JWT middleware, logger
│       ├── server/server.go        # DI wiring + chi router
│       └── db/
│           ├── db.go               # pgxpool connection with retry
│           ├── migrate.go          # golang-migrate via embed.FS
│           └── migrations/         # numbered SQL migration files
└── frontend/
    └── src/
        ├── api/                    # axios wrappers (client.ts, tasks.ts, members.ts, households.ts, auth.ts)
        ├── store/
        │   ├── index.ts            # Zustand app store (tasks, members)
        │   ├── authStore.ts        # Zustand auth store (token, member, guest)
        │   └── guest.ts            # guest-mode localStorage helpers
        ├── components/
        │   ├── ui/                 # Badge, Avatar, Chip, Spinner
        │   ├── layout/             # AppLayout, BottomNav, GuestBanner, AccountMenu
        │   ├── tasks/              # TaskCard, TaskDrawer, AddTaskSheet
        │   ├── members/            # MembersScreen, HouseholdPanel
        │   └── auth/               # PhoneStep, MPINStep, RegisterStep
        ├── pages/                  # TasksPage, StatsPage, MembersPage, AuthPage
        ├── types/index.ts          # all TS interfaces and enum-like const maps
        └── utils/index.ts          # pure utility functions (timeAgo, etc.)
```

---

## Backend Architecture

### Layer Rules (strict, no exceptions)

```
domain  <-- repository  <-- service  <-- handler
```

- **domain**: pure Go structs, repository interfaces, sentinel errors. Zero imports from other internal packages.
- **repository**: implements domain interfaces using `pgxpool`. Raw SQL only. No business logic.
- **service**: imports domain interfaces. Validates input, enforces business rules, calls repository methods.
- **handler**: calls service, reads from `r.Context()` / request body, writes JSON responses. No direct DB access.
- **server.go**: the only place where concrete types are wired together (DI).

### Adding a New Feature (backend checklist)

1. Add entity + repository interface to `internal/domain/`.
2. Add sentinel errors to `internal/domain/errors.go` if new error cases are needed.
3. Implement the repository in `internal/repository/` — one file per aggregate (e.g. `thing_repo.go`).
4. Add a service in `internal/service/` — one file per aggregate (e.g. `thing_service.go`).
5. Add a handler in `internal/handler/` — one file per aggregate (e.g. `thing_handler.go`).
6. Wire up repos, services, and handlers in `internal/server/server.go`.
7. Register routes in the `r.Route("/api/v1", ...)` block.
8. Write a migration if the DB schema changes.

### Domain Conventions

```go
// Typed string enums — always use typed constants, never raw strings
type Category string
const (
    CategoryGrocery Category = "grocery"
    ...
)

// Entities carry only DB fields + optional join fields (pointer or slice)
type Task struct {
    ID       uuid.UUID `json:"id"`
    ...
    Assignee *Member   `json:"assignee,omitempty"` // populated from JOIN
}

// Separate input structs for Create and Update
type CreateTaskInput struct { ... }
type UpdateTaskInput struct {
    Title *string `json:"title,omitempty"` // all fields are pointers (partial update)
}

// Filter structs for list queries
type TaskFilter struct {
    HouseholdID *uuid.UUID
    Category    *Category
    Done        *bool
    Search      string
}

// Repository interface lives in domain alongside the entity it manages
type TaskRepository interface {
    FindAll(filter TaskFilter) ([]Task, error)
    FindByID(id uuid.UUID) (*Task, error)
    Create(input CreateTaskInput) (*Task, error)
    Update(id uuid.UUID, input UpdateTaskInput) (*Task, error)
    Delete(id uuid.UUID) error
    AddComment(taskID uuid.UUID, authorID uuid.UUID, body string) (*Comment, error)
}
```

**Sentinel errors** (`internal/domain/errors.go`):
```go
var (
    ErrNotFound      = errors.New("resource not found")
    ErrInvalidInput  = errors.New("invalid input")
    ErrAlreadyExists = errors.New("resource already exists")
    ErrUnauthorized  = errors.New("unauthorized")
    ErrWrongMpin     = errors.New("wrong mPIN")
)
```
Services always wrap these: `fmt.Errorf("%w: detail", domain.ErrInvalidInput)`.

### Repository Conventions

- Struct is unexported (`type taskRepo struct`), constructor returns the interface.
- Always `context.Background()` for DB calls (no request-scoped context).
- Map `pgx.ErrNoRows` → `domain.ErrNotFound`.
- Map Postgres error code `"23505"` (unique violation) → `domain.ErrAlreadyExists`.
- Use `RETURNING *` or specific columns after INSERT/UPDATE — never do a separate SELECT.
- Use CTE pattern (`WITH ins AS (INSERT ... RETURNING *) SELECT ... FROM ins JOIN ...`) when you need joined data back from a write.
- Define column constants for repeated SELECT lists (e.g. `taskSelectCols`).
- Always `defer rows.Close()` after `Query`.
- For NULL-able TEXT columns, use `COALESCE(col, '')` in the scan to avoid null pointer issues.
- Dynamic WHERE clauses: build `[]string{"1=1"}` + `[]any{}` with a counter `i := 1` for `$N` placeholders.
- Dynamic SET clauses: build `[]string{}` + `[]any{}` with the same counter pattern.

### Service Conventions

- Constructor: `func NewXxxService(dep domain.XxxRepository, ...) *XxxService`.
- Services take domain interfaces, not concrete types — keeps them testable.
- Validate all input at the start of mutation methods before calling the repo.
- Authorization checks (role, household membership) live in the service, not the handler.
- Method names follow Go conventions: `ListTasks`, `GetTask`, `CreateTask`, `UpdateTask`, `DeleteTask`.

### Handler Conventions

All response helpers live in `handler/respond.go`:
```go
type envelope map[string]any

respond(w, http.StatusOK, envelope{"task": task})     // success
respondError(w, err)                                   // auto-maps domain errors to HTTP status
respond(w, http.StatusNoContent, nil)                  // 204 for deletes
```

**HTTP status mapping** (enforced in `respondError`):
| domain error       | HTTP status |
|--------------------|-------------|
| ErrNotFound        | 404         |
| ErrInvalidInput    | 422         |
| ErrUnauthorized    | 401         |
| ErrAlreadyExists   | 409         |
| (other)            | 500         |

Handler pattern:
```go
// GET /things/{id}
func (h *ThingHandler) Get(w http.ResponseWriter, r *http.Request) {
    id, err := uuid.Parse(chi.URLParam(r, "id"))
    if err != nil {
        respond(w, http.StatusBadRequest, envelope{"error": "invalid thing id"})
        return
    }
    thing, err := h.svc.GetThing(id)
    if err != nil {
        respondError(w, err)
        return
    }
    respond(w, http.StatusOK, envelope{"thing": thing})
}
```

- Extract claims with `middleware.ClaimsFromContext(r.Context())` — always check the `ok` bool.
- Parse UUIDs from URL params and JWT claims at the handler level before passing to the service.
- Decode request body with the shared `decode(r, &body)` helper.
- Response envelope key is always the singular noun: `"task"`, `"member"`, `"household"`. Collections use plural: `"tasks"`, `"members"`.
- Add a comment above each handler with the HTTP method + path (e.g. `// GET /tasks/{id}`).

### Middleware / Auth

- `middleware.RequireAuth(authSvc)` validates the Bearer JWT and injects `*domain.Claims` into context.
- `middleware.ClaimsFromContext(ctx)` retrieves it.
- Claims fields: `MemberID`, `Phone`, `Name`, `Avatar`, `Color`, `HouseholdID` (empty string if not in a household).
- All `/api/v1` routes except `/auth/*` are inside the `r.Group(func(r chi.Router) { r.Use(middleware.RequireAuth(authSvc)) ... })` block.
- JWT TTL is 30 days. Token includes `household_id` so household context is available without a DB lookup.

### Router (server.go)

- Routes are defined inside `server.New(...)` only. No route registration elsewhere.
- Group structure: public auth routes first, then the protected group.
- Resource-based route nesting: `/api/v1/tasks/{id}/comments`.
- Add new route groups in the protected block.

### Config

- All config from env vars via `config.Load()` using `getEnv(key, fallback)`.
- Config struct fields: `DatabaseURL`, `Port`, `Env`, `CORSOrigins`, `JWTSecret`.
- Never read `os.Getenv` directly outside `config/config.go`.

---

## Database Migrations

### Naming Convention

```
NNNNNN_short_description.up.sql
NNNNNN_short_description.down.sql
```

- Zero-padded 6-digit sequence: `000001`, `000002`, etc.
- Descriptions are lowercase, words separated by underscores.
- Every `.up.sql` must have a paired `.down.sql` that reverses it exactly.
- Migrations are embedded at compile time via `//go:embed migrations/*.sql` and run automatically on startup.

### SQL Style

- All identifiers: `snake_case`.
- Column types: `UUID` with `DEFAULT gen_random_uuid()` for PKs, `TEXT` for strings, `TIMESTAMPTZ` for timestamps, `BOOLEAN` for flags.
- Timestamps: always `NOT NULL DEFAULT NOW()`.
- Foreign keys: always specify `ON DELETE` behaviour explicitly (`CASCADE`, `RESTRICT`, or `SET NULL`).
- Enums: use `TEXT NOT NULL CHECK (col IN (...))` — no Postgres ENUM types.
- Nullable foreign keys use `NULL` (no `NOT NULL`) so the constraint is optional by design.
- Always add indexes on: FK columns, columns used in WHERE filters, status columns.
- Use `CREATE INDEX IF NOT EXISTS idx_<table>_<column>` naming.
- Use `IF NOT EXISTS` and `IF EXISTS` to make migrations re-runnable safely.
- Partial indexes where appropriate (see migration 5: unique pending join requests).

### Migration Rules

- Never modify an existing migration. Always add a new numbered migration.
- Keep each migration focused on one concern.
- Add comments at the top of each migration file explaining what it does.

---

## Frontend Architecture

### Stores

Two Zustand stores — keep them separate:

| Store | File | Responsibility |
|-------|------|----------------|
| `useAuthStore` | `store/authStore.ts` | JWT token, member profile, guest mode, localStorage persistence |
| `useStore` | `store/index.ts` | tasks, members, filters, loading/error state |

- Auth store is initialized from `localStorage` at module load to prevent auth flash.
- localStorage keys: `hj_token`, `hj_member`, `hj_guest`, `hj_guest_tasks`.
- Guest mode: all mutations go to localStorage via `store/guest.ts` helpers; no API calls.
- Optimistic updates: apply state change immediately, revert on error (see `toggleTask`).

### API Layer

- All HTTP calls go through `api/client.ts` (axios instance with base URL `/api/v1`).
- Axios request interceptor attaches `Authorization: Bearer <token>` from localStorage.
- Axios response interceptor: on 401, clears credentials and redirects to `/auth`.
- Each resource has its own file: `api/tasks.ts`, `api/members.ts`, `api/households.ts`, `api/auth.ts`.
- Exported as named object: `export const tasksApi = { list, get, create, update, remove, addComment }`.
- Functions return the unwrapped resource (not the full axios response): `return data.task`.
- Never call `axios` directly in components or stores — always go through these api modules.

### Types

All shared TypeScript types live in `src/types/index.ts`:
- Domain types: `Task`, `Member`, `Comment`, `Category`, `Priority`
- Payload types: `CreateTaskPayload`, `UpdateTaskPayload`, `LoginPayload`, `RegisterPayload`
- Filter types: `TaskFilter`
- Display constants: `CATEGORIES`, `PRIORITIES` (Record maps with label/icon/color)
- Auth types: `AuthCheckResponse`, `AuthResponse`

Household-specific types (`Household`, `JoinRequest`, `HouseholdInvite`) live in `api/households.ts` since they're only used there and in the members components.

### Component Conventions

- All components are named exports (not default exports): `export function TaskCard(...)`.
- Props interface is named `Props` (local to the file, not exported unless reused).
- Inline styles only — no CSS modules, no Tailwind classes. The design uses a warm neutral palette:
  - Background: `#faf7f2`
  - Border: `#ede8e1`
  - Text primary: `#1c1917`
  - Text secondary: `#78716c`
  - Text muted: `#a8a29e`
  - Indigo (primary interactive): `#6366f1`
  - Indigo light (active backgrounds): `#eef2ff`
  - Semantic orange `#f97316` — used only for Chore category and High priority data badges. Do not use for interactive chrome.
  - Semantic red (overdue/error): `#ef4444` text, `#fecaca` light border
  - Semantic amber (due-soon/warning): `#d97706` text, `#fde68a` border, `#fffbeb` pill background
- Border radius convention: `8–10px` for small elements, `12–14px` for cards/inputs, `20–24px` for panels, `99px` for pills.
- Font: `Fraunces, serif` for headings, system sans-serif for body text.
- Transitions: `all .15s` or `background 0.2s` for interactive elements.
- `slide-up` className is the only CSS animation class (defined in `index.css`).

### Pages

Pages are route-level components in `src/pages/`. They:
- Read from stores with `useStore()` / `useAuthStore()`.
- Compose components — minimal inline logic.
- Handle navigation redirects (e.g. redirect to `/household` if no household yet).
- Named exports, PascalCase: `export function TasksPage()`.

### Routing

```
/auth          → AuthPage (public; redirect to / if already authenticated)
/              → TasksPage  (requires auth or guest)
/stats         → StatsPage  (requires auth or guest)
/household     → MembersPage (requires auth or guest)
*              → redirect to / or /auth
```

- `canAccessApp = isAuthenticated || isGuest` — the gate condition.
- `AppLayout` wraps all app routes: max-width 520px, warm background, `BottomNav`, optional `GuestBanner`.

### Guest Mode

- `isGuest` is set when the user skips login.
- Guest tasks stored in `localStorage` (`hj_guest_tasks`) via helpers in `store/guest.ts`.
- Every store action checks `useAuthStore.getState().isGuest` and branches to local-only logic.
- `GUEST_MEMBER` is a static synthetic member used as the assignee.
- `GuestBanner` prompts the guest to register.

---

## Naming Conventions

### Go (backend)

| Thing | Convention | Example |
|-------|-----------|---------|
| Packages | lowercase single word | `domain`, `repository`, `service`, `handler` |
| Files | `snake_case` | `task_repo.go`, `auth_handler.go` |
| Exported types | `PascalCase` | `TaskService`, `CreateTaskInput` |
| Unexported repo structs | camelCase | `taskRepo`, `memberRepo` |
| Constructor functions | `New<Type>` | `NewTaskService`, `NewTaskRepository` |
| Repository methods | `FindAll`, `FindByID`, `FindByXxx`, `Create`, `Update`, `Delete` | |
| Service methods | `ListXxx`, `GetXxx`, `CreateXxx`, `UpdateXxx`, `DeleteXxx` | |
| Handler methods | `List`, `Get`, `Create`, `Update`, `Delete` | match HTTP semantics |
| Domain typed strings | `TypeName` + `TypeNameValue` | `Category`, `CategoryGrocery` |

### SQL

| Thing | Convention | Example |
|-------|-----------|---------|
| Tables | `snake_case` plural | `tasks`, `household_join_requests` |
| Columns | `snake_case` | `assignee_id`, `created_at`, `mpin_hash` |
| Indexes | `idx_<table>_<column>` | `idx_tasks_category` |
| Constraints | `fk_<table>_<ref>`, `uq_<description>` | `fk_tasks_household`, `uq_pending_join_request` |

### TypeScript (frontend)

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | `PascalCase.tsx` for components, `camelCase.ts` for everything else | `TaskCard.tsx`, `authStore.ts` |
| Components | `PascalCase` named export | `export function TaskCard(...)` |
| Hooks/stores | `useXxx` | `useStore`, `useAuthStore` |
| API modules | `xxxApi` object | `tasksApi`, `householdsApi` |
| Types/interfaces | `PascalCase` | `Task`, `CreateTaskPayload` |
| Type union literals | lowercase strings | `'grocery' | 'chore'` |
| Store actions | camelCase verbs | `fetchTasks`, `toggleTask`, `addComment` |

---

## Security Rules

- `MpinHash` is tagged `json:"-"` on the `Member` struct — never serialized in any response.
- `phone` is tagged `json:"phone,omitempty"` — only included when explicitly needed.
- mPINs are hashed with `bcrypt.DefaultCost` before storage. Never log or return raw PINs.
- All SQL uses parameterized queries (`$1`, `$2`, ...). Never concatenate user input into SQL strings.
- JWT secret comes from `cfg.JWTSecret` (env var). The default value (`CHANGE_ME_IN_PRODUCTION_32_CHARS!`) must be overridden in production.
- Authorization for household-scoped actions is enforced in the service layer by checking `member.HouseholdID` and `member.Role` — never trust client-supplied household IDs for access control.
- Tasks are always filtered by the `household_id` from the JWT claims, not from query parameters.

---

## Rules Claude Must Follow

1. **Never bypass the layer boundary.** Handlers do not call repositories. Services do not call handlers. Domain has no imports from other internal packages.

2. **New domain errors go in `domain/errors.go`.** Use `fmt.Errorf("%w: detail", domain.ErrXxx)` for wrapping. Never create ad-hoc `errors.New(...)` outside the domain package.

3. **New routes go in `server.go` only.** Register them inside the existing `r.Route("/api/v1", ...)` block. Protected routes go inside the `RequireAuth` group.

4. **New repository always returns the domain interface.** Constructor signature: `func NewXxxRepository(db *pgxpool.Pool) domain.XxxRepository`.

5. **New service takes domain interfaces, not concrete types.** Constructor signature: `func NewXxxService(repo domain.XxxRepository, ...) *XxxService`.

6. **Every new DB table/column needs a migration.** Create `NNNNNN_description.up.sql` and `NNNNNN_description.down.sql`. Never modify existing migration files.

7. **All migrations use `IF NOT EXISTS` / `IF EXISTS` guards.** All FK columns have explicit `ON DELETE` clauses. All new columns queried in WHERE get an index.

8. **No raw SQL in services or handlers.** SQL lives only in repository files.

9. **Response envelopes use consistent key names.** Singular noun for single resource (`"task"`), plural for collections (`"tasks"`). Deletes return `204 No Content` with a nil body.

10. **HTTP error responses always use `respondError(w, err)`.** Only call `respond(w, http.StatusBadRequest, ...)` for input parsing errors that happen before the service is called.

11. **Frontend: no direct axios calls.** All HTTP calls go through the api modules (`tasksApi`, `householdsApi`, etc.).

12. **Frontend: all new shared types go in `src/types/index.ts`.** API-specific response shapes that are not reused elsewhere may live in the api file.

13. **Frontend: every store action must handle guest mode.** Check `useAuthStore.getState().isGuest` and either operate on localStorage or skip the API call gracefully.

14. **Frontend: inline styles only.** No new CSS files, no CSS-in-JS libraries, no utility class frameworks.

15. **Frontend: components are named exports.** Never use default exports for components.

16. **Do not add ORM, query builder, or any abstraction over pgx.** Raw SQL with parameterized queries is the pattern.

17. **Do not introduce new packages without discussion.** The current dependency set is intentionally minimal.

18. **Any API change must update the Postman collection.** When adding, removing, or modifying any route, request body, response shape, or query parameter:
    1. Update `postman/HomeJira.postman_collection.json` to reflect the change (add/edit/remove the relevant request item).
    2. Use the Postman MCP tool (`putCollection` with `collectionId: "23441410-82632e0b-9da4-47b9-a5a9-5a0830650160"`) to push the updated JSON to Postman.
    3. Stage the collection file alongside the API change — the pre-commit hook blocks commits where handler/server files change but the collection does not.
    The collection JSON is the source of truth; the live Postman collection is always derived from it.

19. **Run live API smoke tests after every release to staging and production.** After any PR merges to `staging` or `main`, run the following checks against the live API before declaring the release complete:

    **Staging API:** `https://homejira-staging.up.railway.app/api/v1`
    **Production API:** `https://homejira.up.railway.app/api/v1`

    ```bash
    # 1. Public config endpoint responds 200 with flags object
    curl -s "$API/config"                                      # → 200 {"flags":{...}}

    # 2. Auth guard active — unauthenticated requests return 401
    curl -s -o /dev/null -w "%{http_code}" "$API/tasks"        # → 401
    curl -s -o /dev/null -w "%{http_code}" "$API/members"      # → 401

    # 3. Known-bad join code returns 401 (auth gate) — NOT 500
    curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -d '{"code":"XXXXXX"}' "$API/households/join-by-code"   # → 401 (not 500)

    # 4. /auth/check public route exists
    curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -d '{"phone":"+10000000000"}' "$API/auth/check"         # → 200/404/422 (not 500)
    ```

    Any 5xx response is a release blocker — roll back and investigate before proceeding.

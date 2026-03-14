# CLAUDE.md — HomeJira Codebase Guide

Authoritative reference for how code is written. Read before adding any feature, endpoint, or component.

---

## Git Workflow

```
main (production)
└── staging (staging environment)
    └── feature/* or fix/* (work branches)
```

1. Branch off `staging`: `git checkout staging && git pull && git checkout -b feature/my-thing`
2. Verify locally (`make up`) before opening a PR
3. PR targets `staging` — never `main`; CI must pass
4. Verify in staging env (Railway staging + Vercel preview)
5. Merge staging → main to promote to production

**Merge strategy:**
- `feature/* → staging`: **regular merge** (`gh pr merge --merge`)
- `staging → main`: **regular merge** (`gh pr merge --merge`)

**Rules:** Never commit directly to `main` or `staging`. All feature/fix PRs target `staging`. `main` only receives PRs from `staging`.

---

## Project Overview

HomeJira — household task management ("Jira for home"). Go backend + TypeScript frontend.
Members belong to a **Household**. Tasks are scoped to a household.
Auth: phone + 4-digit mPIN → JWT (7-day TTL). Guest mode: localStorage only, no API calls.

**Service URLs**
| Env | Frontend | API |
|-----|----------|-----|
| Dev | http://localhost:3000 | http://localhost:8080/api/v1 |
| Staging | https://homejira-git-staging-vibeoskis-projects.vercel.app | https://homejira-staging.up.railway.app/api/v1 |
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
│       ├── middleware/             # auth JWT, logger
│       ├── server/server.go        # DI wiring + chi router
│       └── db/migrations/          # numbered SQL migration files
└── frontend/src/
    ├── api/                        # axios wrappers (client.ts, tasks.ts, members.ts, households.ts, auth.ts)
    ├── store/                      # index.ts (app), authStore.ts (auth), guest.ts
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
const ( CategoryGrocery Category = "grocery" ... )

type Task struct {
    ID       uuid.UUID `json:"id"`
    Assignee *Member   `json:"assignee,omitempty"` // populated from JOIN
}

type UpdateTaskInput struct {
    Title *string `json:"title,omitempty"` // all update fields are pointers
}

type TaskFilter struct { HouseholdID *uuid.UUID; Category *Category; Done *bool; Search string }

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
- Claims: `MemberID`, `Phone`, `Name`, `Avatar`, `Color`, `HouseholdID` (empty string if none).
- All routes except `/auth/*` are inside the `RequireAuth` group.
- JWT TTL 7 days. `household_id` embedded in token.

### Config

- All config from env via `config.Load()`. Fields: `DatabaseURL`, `Port`, `Env`, `CORSOrigins`, `JWTSecret`.
- Never `os.Getenv` outside `config/config.go`.

---

## Database Migrations

**Naming:** `NNNNNN_short_description.up.sql` / `.down.sql` (zero-padded 6-digit, lowercase underscores).
Every `.up.sql` has a paired `.down.sql`. Migrations embedded at compile time via `//go:embed`.

**SQL Style:**
- Identifiers: `snake_case`. PKs: `UUID DEFAULT gen_random_uuid()`. Strings: `TEXT`. Timestamps: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- FKs: always explicit `ON DELETE` (`CASCADE`/`RESTRICT`/`SET NULL`).
- Enums: `TEXT NOT NULL CHECK (col IN (...))` — no Postgres ENUM types.
- Indexes: `CREATE INDEX IF NOT EXISTS idx_<table>_<column>` on FK cols, WHERE cols, status cols.
- Always use `IF NOT EXISTS` / `IF EXISTS` guards.

**Rules:** Never modify existing migrations. One concern per migration. Add comment at top.

---

## Frontend Architecture

### Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `useAuthStore` | `store/authStore.ts` | JWT token, member profile, guest mode, localStorage |
| `useStore` | `store/index.ts` | tasks, members, filters, loading/error state |

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

- `MpinHash` tagged `json:"-"` — never serialized. `phone` tagged `json:"phone,omitempty"`.
- mPINs hashed with `bcrypt.DefaultCost`. Never log raw PINs.
- All SQL uses parameterized queries. Never concatenate user input.
- JWT secret from env (`cfg.JWTSecret`). Override `CHANGE_ME_IN_PRODUCTION_32_CHARS!` in production.
- Household authorization (role, membership) enforced in service layer — never trust client-supplied household IDs.
- Tasks filtered by `household_id` from JWT claims, not query params.

---

## Backend Notes

- SSE endpoints: ensure middleware wrappers implement `http.Flusher` — otherwise returns 500 (can't flush response).

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

18. **Any API change must update the Postman collection.**
    1. Update `postman/HomeJira.postman_collection.json`.
    2. Push via Postman MCP `putCollection` (`collectionId: "23441410-82632e0b-9da4-47b9-a5a9-5a0830650160"`).
    3. Stage collection file alongside the API change — pre-commit hook blocks mismatched commits.

19. **Run smoke tests after every release to staging and production.**

    ```bash
    API=https://homejira-staging.up.railway.app/api/v1  # or production URL
    curl -s "$API/../health"                                          # → 200 {status:ok, db:ok}
    curl -s "$API/config"                                             # → 200 {flags:{...}}
    curl -s -o /dev/null -w "%{http_code}" "$API/tasks"              # → 401
    curl -s -o /dev/null -w "%{http_code}" "$API/members"            # → 401
    curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" -d '{"code":"XXXXXX"}' \
      "$API/households/join-by-code"                                  # → 401 (not 500)
    curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" -d '{"phone":"+10000000000"}' \
      "$API/auth/check-phone"                                         # → 200
    ```

    Any 5xx = release blocker — roll back immediately.

20. **All PRs require QA sign-off before merge.** Backend-only → `/qa1`. Frontend-only → `/qa2`. Full-stack → both. No merge without "QA-1 ✅" / "QA-2 ✅" comment on the PR.

21. **Nullable TEXT columns scanned into Go `string` must use `COALESCE(col, '')`.** Apply to every SELECT/RETURNING query for that column, not just new ones.

22. **Run QA automation scripts in the background to avoid token bloat.** When executing test or smoke-test scripts (e.g. `test_idor_local.sh`, curl smoke suites, `go test ./...`), use the Bash tool with `run_in_background: true`. Only read the output via `TaskOutput` if the script fails or the user asks for results. Never stream verbose test output into the main conversation context.

---

## Preferences

- When asked to create multiple deliverables (e.g., diagrams, docs, collections), create ALL of them without asking.

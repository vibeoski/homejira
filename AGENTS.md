# AGENTS.md — HomeJira Agent Handoff Guide

This file enables any AI agent to orient quickly and pick up work without prior conversation context.
Read this **before** reading anything else. Then read `CLAUDE.md` for codebase rules.

---

## What Is This Project?

**HomeJira** — household task management ("Jira for home").
- Go backend + React/TypeScript frontend
- Members belong to a **Household**. Tasks are scoped to a household.
- Auth: username + 4-digit mPIN → JWT (7-day TTL)
- No guest mode (deprecated 2026-03-20, remove any `isGuest` branches you find)

---

## Quick Start

```bash
make up        # start all services (Docker Compose)
make down      # stop
make seed      # seed the DB
make logs-api  # tail Go API logs
make shell-db  # psql into Postgres
```

**Service URLs (dev)**
- Frontend: http://localhost:3000
- API: http://localhost:8080/api/v1

**Test account:** username `+15550000001` · mPIN `1234` · Name "Test User"

---

## Git Workflow

```
main (production)
└── feature/* or fix/* (work branches)
```

1. `git checkout main && git pull && git checkout -b feature/my-thing`
2. Verify locally with `make up`
3. PR targets `main` — CI must pass; merge with `gh pr merge --merge`
4. **Never commit directly to `main`**

---

## Active State (as of 2026-03-22)

### Sprint Status
- **Sprint 4**: CLOSED (14/14 issues, GitHub milestone #1, closed 2026-03-09)
- **Sprint 5**: CLOSED (all 8 frontend bugs #70–#77 resolved)
- **Sprint 6**: AWS infrastructure migration — issues #192–#202

### Sprint 6 Issues
- `#192` Terraform VPC + networking
- `#193` RDS PostgreSQL instance
- `#194` ECS Fargate service
- `#195` Secrets Manager setup
- `#196` CI/CD pipeline (GitHub Actions → ECR → ECS)
- `#197` S3 + CloudFront for frontend
- `#198` DNS cutover
- `#199` Secret scanning hook
- `#200` CloudWatch alarms
- `#201` Dependency audits in CI (done — shipped in Sprint 5)
- `#202` Load testing

### Unscheduled Necessary
- `#42` — notification feed (L)
- `#44` — recurring tasks (L)

### In-Flight Infrastructure Migration
- Railway (API) + Vercel (frontend) → **AWS**
- Target: ECS Fargate + RDS (API), S3 + CloudFront (frontend)
- IaC: Terraform · Secrets: HashiCorp Vault or AWS Secrets Manager
- CI/CD: GitHub Actions → ECR → ECS deploy
- No new Railway or Vercel config should be created

---

## Agent Team — Role Assignments

Automatically adopt the right role based on task domain. No need to be asked.

| Role | Domain | Key Rules |
|------|--------|-----------|
| **Engineering Manager** | Sprint planning, coordination, release gating | Start from GitHub Issues; enforce lean scope; no release without QA sign-off |
| **Backend Engineer** | Go API, migrations, SSE, layer rules | Strict layer boundary: domain ← repo ← service ← handler; raw SQL only; no ORM |
| **Frontend Engineer** | React/TS, Zustand, inline styles | Named exports; inline styles only; all HTTP via `src/api/`; no CSS files |
| **QA Engineer** | Smoke tests, release gate, Postman | 16-check suite; poll `/health` SHA before tests; any 5xx = blocker + rollback |
| **Product Designer** | Design tokens, component specs, UX flows | Fixed palette (see below); `slide-up` only animation; no emoji unless asked |
| **DevOps Engineer** | AWS, Terraform, HashiCorp Vault, CI/CD | All infra as code; no secrets in files; private subnets for RDS; ALB → ECS → RDS |

---

## Codebase Map

```
homejira/
├── backend/
│   ├── cmd/server/main.go          # entry point
│   ├── config/config.go            # env config (only place for os.Getenv)
│   └── internal/
│       ├── domain/                 # entities, interfaces, sentinel errors
│       ├── repository/             # pgx SQL (raw SQL only)
│       ├── service/                # business logic
│       ├── handler/                # HTTP handlers
│       ├── middleware/             # JWT auth, logger, rate limiter
│       ├── sse/hub.go              # SSE pub/sub hub
│       ├── server/server.go        # DI wiring + chi router
│       ├── middleware/             # JWT auth, logger, rate limiter, security headers
│       └── db/migrations/          # 000001–000018 SQL files
└── frontend/src/
    ├── api/                        # client.ts + resource modules
    ├── store/                      # index.ts, authStore.ts, configStore.ts
    ├── components/                 # ui/, layout/, tasks/, members/, stats/, auth/
    ├── pages/                      # TasksPage, StatsPage, MembersPage, GroceryPage, AuthPage, etc.
    ├── types/index.ts              # ALL shared TS types (add new types here)
    └── utils/index.ts              # pure utility functions
```

---

## Backend Rules (non-negotiable)

- Layer boundary: **handler → service → repository → domain** — no skipping
- Handlers call service only. Services call repo only. Repos do SQL only.
- New sentinel errors in `domain/errors.go`. Wrap: `fmt.Errorf("%w: detail", domain.ErrXxx)`
- New routes registered in `server.go` only, inside `r.Route("/api/v1", ...)`
- Repo constructors return domain interface. Service constructors take domain interfaces.
- All nullable TEXT columns: `COALESCE(col, '')` in every SELECT/RETURNING scan
- New migrations: `000019_xxx.up.sql` + `.down.sql`. Never modify existing migrations.
- No ORM. No query builder. Raw parameterized SQL only.

**Error → HTTP mapping:** `ErrNotFound`→404 · `ErrInvalidInput`→422 · `ErrUnauthorized`→401 · `ErrAlreadyExists`→409 · other→500

---

## Frontend Rules (non-negotiable)

- All HTTP through `src/api/` modules. Never call axios directly in a component.
- Inline styles only. No CSS files, Tailwind, CSS-in-JS.
- Components are named exports only (`export function Foo`). Never default export.
- All shared TS types in `src/types/index.ts`.
- Guest mode is **DEPRECATED** — remove `isGuest` branches, do not add new ones.

**Design tokens (fixed):**
- bg `#faf7f2` · border `#ede8e1` · text `#1c1917` · secondary `#78716c` · muted `#a8a29e`
- Primary: `#6366f1` · Active bg: `#eef2ff`
- Orange `#f97316`: chore/high-priority data ONLY — never interactive chrome
- Error: `#ef4444`/`#fecaca` · Warning: `#d97706`/`#fde68a`/`#fffbeb`
- Font: `Fraunces, serif` headings, system sans-serif body
- Radii: 8–10px small · 12–14px cards · 20–24px panels · 99px pills
- Transition: `all .15s` · Animation: `slide-up` only

---

## Critical Bugs — Do Not Re-introduce

| Bug | Rule |
|-----|------|
| pgx scan panic on NULL username | Always `COALESCE(username, '')` in every member SELECT/RETURNING |
| `phone` column reference | Column was renamed to `username` in migration 000016 — never use `phone` |
| Groceries as task category | Groceries = separate table (migration 000017). Task categories = `chore\|errand\|repair` only |
| `POST /members` route | Does not exist. Member creation is via `POST /auth/register` only |
| Firebase/OTP auth | Was trialled and removed. Do not re-introduce. |
| Guest mode | Deprecated 2026-03-20. Remove existing `isGuest` branches when touched. |

---

## Database Schema (key tables)

| Table | Key columns |
|-------|-------------|
| `members` | id, name, avatar, color, username (nullable→COALESCE), mpin_hash, household_id (nullable FK), role |
| `tasks` | id, title, notes, category (`chore\|errand\|repair`), priority (`urgent\|high\|normal`), status (`open\|in_progress\|on_hold\|done`), assignee_id, household_id, done, done_at, due_at |
| `groceries` | id, title, quantity, notes, done, done_at, household_id, assignee_id |
| `households` | id, name, kind (`home\|group`), join_code |
| `coin_transactions` | id, member_id, amount, reason, meta (JSONB) |
| `feature_flags` | key, enabled |

Latest migration: **000018** (`add_task_status`)
Next migration number: **000019**

---

## CI / CD

### CI (4 jobs — all required to pass before merge)
- `Backend — build, vet, test` — Go 1.25, `go build` + `go vet` + `go test ./...`
- `Frontend — build, lint` — `npm run build` + `npm run lint`
- `Dependency audit` — `govulncheck ./...` + `npm audit --audit-level=high`
- `Secret scan` — `gitleaks` on changed files

### Staging Auto-Deploy (on merge to `main`)
1. Railway GraphQL `serviceInstanceRedeploy` mutation triggers staging redeploy
2. Polls `GET /health` every 15 s until new commit SHA is live (20 attempts max)
3. 8-check smoke suite runs automatically
4. On failure: auto-creates `blocker` GitHub issue

## Release Gate Protocol (QA)

1. Merge PR to `main` — CI must pass all 4 jobs
2. Staging auto-deploys and smoke tests run (GitHub Actions)
3. Verify staging smoke tests passed
4. Trigger prod deploy manually
5. Re-run smoke suite against prod
6. Any 5xx → immediate rollback + file blocker GitHub issue

---

## External Resources

- **GitHub Issues**: https://github.com/vibeoski/homejira/issues (sole backlog source of truth)
- **Production frontend**: https://homejira.app
- **Production API**: https://homejira.up.railway.app/api/v1
- **Staging API**: https://homejira-staging.up.railway.app/api/v1
- **Postman collection**: `postman/HomeJira.postman_collection.json`

---

## Preferences

- When asked to create multiple deliverables (diagrams, docs, collections), create ALL without asking.
- Terse responses — lead with the action, not the reasoning.
- Merge strategy: regular merge (`gh pr merge --merge`). No squash merges.
- One concern per PR. One PR per sprint issue.
- Run smoke/test scripts with `run_in_background: true` to avoid token bloat.

# HomeJira — Backlog

Priority levels: 🔴 Blocker · 🟡 Necessary · 🟢 Roadmap
Status: `todo` · `in_progress` · `done`

---

## 🔴 Blockers

### BL-01 · TaskDrawer posts comments as wrong user
**Status:** `done`
**File:** `frontend/src/components/tasks/TaskDrawer.tsx:22`
`const me = members[0]` grabs the first member in the list instead of the authenticated user.
Any member can accidentally post comments attributed to someone else.
**Fix:** replace with `useAuthStore` to get the actual logged-in member.

---

### BL-02 · No "Promote to Admin" feature
**Status:** `done`
**Files:** backend service/handler/router · `MembersScreen.tsx`
`LeaveHousehold` blocks the sole admin from leaving until a second admin exists, but there
is no API endpoint or UI to promote a member. The sole admin is permanently stuck.
**Fix:**
- `PATCH /api/v1/households/members/{id}/promote` (admin only)
- Service: `PromoteMember(adminID, targetID)` — verify same household, set role = admin
- UI: promote button next to each non-admin member in `MembersScreen`

---

### BL-03 · Tasks orphaned when a member is removed / leaves
**Status:** `done`
**Files:** `household_service.go` · `task_repo.go`
When a member leaves or is removed, their assigned tasks remain in the household with a
dangling `assignee_id`. They still appear in the list assigned to a non-member.
**Fix:** In `RemoveMember` and `LeaveHousehold`, reassign all open tasks belonging to that
member to the acting admin (or household creator) before clearing the member's household.
- New repo method: `ReassignTasks(fromMemberID, toMemberID, householdID uuid.UUID) error`

---

## 🟡 Necessary

### NE-01 · Category not editable in TaskDrawer
**Status:** `done`
**File:** `frontend/src/components/tasks/TaskDrawer.tsx`
Category is rendered as a static chip. No `patch({ category })` is wired up. A task created
as `grocery` can never be recategorised.
**Fix:** Replace static `Chip` with clickable category selector that calls `patch({ category })`.

---

### NE-02 · No profile editing
**Status:** `done`
**Files:** backend · `AccountMenu.tsx`
After registration there is no way to change name, avatar, or color. `AccountMenu` is read-only.
**Fix:**
- `PATCH /api/v1/members/me` — update name, avatar, color
- Service: `UpdateProfile(memberID, name, avatar, color)`
- UI: edit form inside `AccountMenu` dropdown or a dedicated profile sheet

---

### NE-03 · No mPIN change
**Status:** `done`
**Files:** backend · `AccountMenu.tsx`
Credentials are permanent after registration. No endpoint exists to change the mPIN.
**Fix:**
- `PATCH /api/v1/auth/mpin` — requires current mPIN + new mPIN (protected route)
- Service: `ChangeMpin(memberID, currentMpin, newMpin)`
- UI: "Change PIN" option in `AccountMenu`

---

### NE-04 · Sign-out does not invalidate JWT server-side
**Status:** `done`
**File:** `frontend/src/store/authStore.ts` · `auth_service.go`
Logout clears `localStorage` but the 30-day JWT remains valid. A copied token continues
to work until expiry.
**Fix (pragmatic):** Shorten JWT TTL to 7 days + use the existing `/auth/refresh` endpoint
to silently extend sessions. For full invalidation a token blocklist (Redis or DB table) is needed.

---

### NE-05 · Due dates on tasks
**Status:** `done`
**Files:** migration · domain · repository · service · handler · frontend types · `AddTaskSheet` · `TaskDrawer` · `TaskCard`
No `due_at` column exists. Creating a task with a deadline is a core household feature.
**Fix:**
- Migration: `ADD COLUMN due_at TIMESTAMPTZ` on `tasks`
- Domain: add `DueAt *time.Time` to `Task`, `CreateTaskInput`, `UpdateTaskInput`, `TaskFilter`
- Repository: include in SELECT/INSERT/UPDATE, add filter for overdue
- Frontend: date picker in `AddTaskSheet` and `TaskDrawer`, overdue badge in `TaskCard`

---

### NE-06 · Auth endpoints have no rate limiting
**Status:** `done`
**File:** `internal/server/server.go` · `internal/middleware/`
`/auth/login` is brute-forceable — 4-digit mPIN = 10,000 combinations with no lockout or
delay after failures.
**Fix:** Add a `RateLimit` middleware (in-memory token bucket or fixed-window counter keyed
by IP) applied to the `/auth` route group. Limit to ~10 attempts / minute per IP.

---

### NE-07 · Stats page has no empty state
**Status:** `done`
**File:** `frontend/src/components/stats/StatsScreen.tsx`
When a member has 0 tasks assigned, their row renders `0/0` with a flat bar and no message.
The overall completion ring also shows `0%` with no explanation when the household is new.
**Fix:** Add "No tasks yet" placeholder for the overall card and skip (or note) members with
0 assigned tasks.

---

## 🎨 UI/UX

### UX-01 · AccountMenu → bottom sheet
**Status:** `done`
Replace the cramped dropdown with a full bottom sheet (avatar, name, color, Change PIN, Sign out).

### UX-02 · Destructive action inline confirms
**Status:** `done`
Delete Task and Remove Member should require a single inline confirm step before executing.

### UX-03 · TaskDrawer section grouping
**Status:** `done`
Group controls into three visual zones: Identity, Classification, Collaboration. Add dividers.

### UX-04 · Task list empty state
**Status:** `done`
When a household has zero tasks, show a friendly placeholder with a shortcut to add the first task.

### UX-05 · Bottom nav labels
**Status:** `done`
Add short text labels under each icon in the bottom nav.

### UX-06 · TaskCard information hierarchy
**Status:** `done`
Restructure card into three clear rows: title (2-line), category + avatar, due/comments.

### UX-07 · Checkbox micro-animation
**Status:** `done`
Scale pop + color fade on task toggle. Optimistic comment send. Promote/Remove success flash.

---

## 🎨 Design

### DS-01 · Full UI revamp — minimal, modern, simple
**Status:** `done`
**Files:** `index.css` · all component files
Complete visual redesign:
- Neutral `#f4f4f5` background (was warm `#faf7f2`)
- Pure white cards with 1px `#e4e4e7` borders
- Accent changed from orange `#f97316` to indigo `#6366f1`
- Typography: DM Sans throughout (removed Fraunces serif)
- Replaced emoji nav icons with inline SVG icons in BottomNav
- Tighter spacing, smaller radii (12px cards, 8px inputs)
- Consistent zinc text palette: `#18181b` / `#71717a` / `#a1a1aa`

---

## 🎨 UI/UX (Round 2)

### UX-08 · JoinPage missing "Sign in" button
**Status:** `done`
**File:** `frontend/src/pages/JoinPage.tsx`
The note "Already have an account? Sign in to join automatically." is plain text with no action.
Existing users have no button to proceed — dead end.
**Fix:** Add a secondary "Sign in" button that calls the same pending-join flow.

---

### UX-09 · Stats overall ring includes grocery items
**Status:** `done`
**File:** `frontend/src/components/stats/StatsScreen.tsx`
The overall "X of Y done" ring counts grocery check-offs alongside household tasks, inflating
the completion % and making the number meaningless.
**Fix:** Filter out `category=grocery` from `done` and `total` in the ring. Category breakdown
card for grocery stays (useful for per-category view).

---

### UX-10 · Grocery "Clear done" label sounds destructive
**Status:** `done`
**File:** `frontend/src/pages/GroceryPage.tsx`
"Clear done" reads like a delete. It actually just collapses the done section.
**Fix:** Rename to "Hide done".

---

### UX-11 · AccountMenu missing from Grocery page header
**Status:** `done`
**File:** `frontend/src/pages/GroceryPage.tsx`
Every other page header has an AccountMenu. Grocery does not — users can't access
profile/settings/sign-out from this tab.
**Fix:** Import and add `<AccountMenu />` to the Grocery page header.

---

### UX-12 · Tasks search has no clear (×) button
**Status:** `done`
**File:** `frontend/src/pages/TasksPage.tsx`
After typing in the search field there is no clear button — users must manually backspace.
**Fix:** Show a small × icon button inside the input when `search !== ''`.

---

### UX-13 · "All clear" empty state has no filter reset
**Status:** `done`
**File:** `frontend/src/pages/TasksPage.tsx`
When filters produce 0 results the "All clear! Nothing matches." state gives no escape
route — users must manually unset all filters.
**Fix:** Add a "Reset filters" button on the All clear state that resets catTab, filterStatus,
myTasks, and search to defaults.

---

### UX-14 · Grocery loading state uses raw text
**Status:** `done`
**File:** `frontend/src/pages/GroceryPage.tsx`
The grocery loading state renders raw "Loading…" text while all other pages use `<Spinner />`.
**Fix:** Replace with `<Spinner />`.

---

### UX-15 · Grocery empty state is plain text
**Status:** `done`
**File:** `frontend/src/pages/GroceryPage.tsx`
TasksPage has an illustrated empty state with icon + headline + CTA. Grocery shows plain text.
**Fix:** Match the visual language with an icon, headline, and supporting copy.

---

### UX-16 · Grocery items have no edit capability
**Status:** `done`
**File:** `frontend/src/pages/GroceryPage.tsx` · `GroceryRow` sub-component
A typo in an item title requires deleting and re-adding.
**Fix:** Tap-to-edit on row title — click the text to show an inline input; save on Enter/blur.

---

### UX-17 · Sort toggle label is ambiguous
**Status:** `done`
**File:** `frontend/src/pages/TasksPage.tsx`
The button shows "Priority" when sorted by priority — looks like a no-op. Clicking it
switches to "Recent" but nothing signals the button is a toggle.
**Fix:** Prefix with "Sort: " so users read "Sort: Priority" and understand it's interactive.

---

### UX-18 · Stats "By member" header renders with no members
**Status:** `done`
**File:** `frontend/src/components/stats/StatsScreen.tsx`
The "By member" section label renders even when `members.length === 0` (guest mode).
**Fix:** Wrap the entire section in `{members.length > 0 && ...}`.

---

### UX-19 · Stats lacks urgency summary
**Status:** `done`
**File:** `frontend/src/components/stats/StatsScreen.tsx`
Stats are passive (completion only). No overdue or urgent count is surfaced, so the page
gives no actionable signal.
**Fix:** Add a small summary row below the ring showing overdue count and urgent open count,
drawn from non-grocery tasks.

---

## 🟡 Necessary

### NE-08 · No task assignment notifications
**Status:** `todo`
**Files:** backend · frontend
`due_at` exists but is completely silent. Members have no way to know when a task is assigned to
them or when a due date is approaching. The feature exists on paper but delivers no actionable signal.
**Fix:**
- In-app notification feed (bell icon in header) — recorded in a `notifications` table
- Events: task assigned to me, task overdue, task due in 24 h
- Backend: `POST /api/v1/notifications/read` to mark seen; SSE push for real-time badge
- Frontend: notification badge count in header, simple drop-down list

---

### NE-09 · Grocery items have no quantity / unit field
**Status:** `todo`
**File:** `frontend/src/pages/GroceryPage.tsx` · backend tasks domain
Grocery items only have a title. "Milk" vs "2 gallons of milk" is a meaningful difference when
shopping. There is no way to specify amount, size, or unit.
**Fix:**
- Migration: `ADD COLUMN quantity TEXT` on `tasks` (nullable, grocery-only semantic)
- Backend: include in `CreateTaskInput`, `UpdateTaskInput`, and API responses
- Frontend: optional quantity input in the add-grocery form and inline below the item title

---

### NE-10 · Recurring tasks
**Status:** `todo`
**Files:** backend · domain · migration · frontend `AddTaskSheet` · `TaskDrawer`
Common household chores (trash, laundry, bills) need to auto-reopen on a schedule. Without this,
members manually re-create the same tasks every week.
**Fix:**
- Migration: `ADD COLUMN recurrence TEXT CHECK (IN ('daily','weekly','monthly','none'))` +
  `recurrence_next_at TIMESTAMPTZ` on `tasks`
- Backend: background worker (ticker) that scans for completed recurring tasks past
  `recurrence_next_at` and re-opens them (new row or reset done=false + bump next_at)
- Frontend: recurrence selector in `AddTaskSheet` and `TaskDrawer`

---

## 🟢 Roadmap

### RD-00 · Task activity history
**Status:** `done`
Unified activity + comment feed in TaskDrawer. `task_activities` table records created/completed/reopened/assigned/priority_changed/category_changed/title_changed/notes_changed/due_set/due_cleared events. `GET /tasks/{id}/activity`. Feed sorted chronologically; activities render as compact log lines, comments as bubbles.

### RD-02 · Shopping list aggregation
**Status:** `done`
Implemented as `GroceryPage` — dedicated tab that shows all `category=grocery` tasks with check-off,
hide-done toggle, inline edit, and illustrated empty state.

### RD-03 · Real-time sync (SSE / WebSockets)
**Status:** `done`
Replaced all polling with SSE. Member-level channels for join-request flow. Hub notifies household on every task/household mutation.

### RD-04 · Shareable invite links
**Status:** `done`
Backend generates token-based invite URLs (`/join/:token`). `JoinPage` resolves the token to a
household name, auto-joins authenticated users, and routes unauthenticated users through sign-up
with a pending-join flag in localStorage.

### RD-05 · Dark mode
**Status:** `todo`

### RD-06 · PWA (installable, offline)
**Status:** `todo`

### RD-07 · Household spending tracker
**Status:** `todo`
Attach an optional cost to grocery/errand tasks. Monthly spend summary in Stats.

### RD-08 · Task templates
**Status:** `todo`
Save a set of tasks as a reusable template (e.g. "Spring cleaning checklist") that can be
bulk-applied to the household.

---

## Changelog

| ID | Change | Date |
|----|--------|------|
| — | Backlog created | 2026-03-06 |
| RD-00 | Task activity history (unified feed, 10 event kinds, migration + full stack) | 2026-03-06 |
| RD-03 | SSE live sync + member channels (join-request flow, no polling) | 2026-03-06 |
| BL-01 | Fixed comment author (useAuthStore) | 2026-03-06 |
| BL-02 | Promote to Admin (PATCH /members/{id}/promote + UI) | 2026-03-06 |
| BL-03 | ReassignTasks on remove/leave | 2026-03-06 |
| NE-01 | Category editable in TaskDrawer | 2026-03-06 |
| NE-02 | Profile editing (PATCH /members/me + AccountMenu) | 2026-03-06 |
| NE-03 | mPIN change (PATCH /auth/mpin + AccountMenu) | 2026-03-06 |
| NE-04 | JWT TTL shortened to 7 days | 2026-03-06 |
| NE-05 | Due dates (migration + full stack) | 2026-03-06 |
| NE-06 | Rate limiting on auth endpoints (10/min per IP) | 2026-03-06 |
| NE-07 | Stats empty state | 2026-03-06 |
| UX-01 | AccountMenu → bottom sheet (profile + PIN sheets) | 2026-03-06 |
| UX-02 | Inline confirm on Delete Task + Remove Member | 2026-03-06 |
| UX-03 | TaskDrawer three-zone layout (Identity / Classification / Collaboration) | 2026-03-06 |
| UX-04 | Task list empty state (new household vs filtered empty) | 2026-03-06 |
| UX-05 | Bottom nav active indicator bar + font-weight | 2026-03-06 |
| UX-06 | TaskCard 3-row hierarchy (title / category+notes / due+comments) | 2026-03-06 |
| UX-07 | Checkbox pop animation, optimistic comment send, promote flash | 2026-03-06 |
| DS-01 | Full UI revamp — indigo accent, neutral palette, SVG nav icons, DM Sans only | 2026-03-06 |
| UX-08 | JoinPage — added "Sign in" secondary button for existing users | 2026-03-07 |
| UX-09 | Stats ring excludes grocery tasks from done/total count | 2026-03-07 |
| UX-10 | Grocery "Clear done" renamed to "Hide done" | 2026-03-07 |
| UX-11 | AccountMenu added to Grocery page header | 2026-03-07 |
| UX-12 | Tasks search — clear (×) button appears when input non-empty | 2026-03-07 |
| UX-13 | Tasks "All clear" empty state — "Reset filters" button added | 2026-03-07 |
| UX-14 | Grocery loading state now uses Spinner component | 2026-03-07 |
| UX-15 | Grocery empty state — illustrated with icon, headline, and copy | 2026-03-07 |
| UX-16 | Grocery items — tap-to-edit inline input (Enter/blur saves, Escape cancels) | 2026-03-07 |
| UX-17 | Sort toggle label prefixed with "Sort: " for clarity | 2026-03-07 |
| UX-18 | Stats "By member" section hidden when no members exist | 2026-03-07 |
| UX-19 | Stats urgency summary cards (overdue + urgent counts) added | 2026-03-07 |

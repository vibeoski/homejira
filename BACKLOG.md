# HomeJira — Backlog

> **Active backlog has moved to GitHub Issues:**
> https://github.com/vibeoski/homejira/issues
>
> Labels: `blocker` · `necessary` · `roadmap` · `backend` · `frontend` · `migration`
>
> This file is kept as a historical changelog only. Do not add new items here — open a GitHub Issue instead.

---

## Done

### 🔴 Blockers

#### BL-01 · TaskDrawer posts comments as wrong user — `done`
`const me = members[0]` grabbed the first member instead of the authenticated user.
**Fix:** replaced with `useAuthStore` to get the actual logged-in member.

#### BL-02 · No "Promote to Admin" feature — `done`
The sole admin was permanently stuck — no way to promote another member before leaving.
**Fix:** `POST /households/members/{id}/promote` + UI promote button in MembersScreen.

#### BL-03 · Tasks orphaned when a member is removed / leaves — `done`
Dangling `assignee_id` after member removal left tasks assigned to a non-member.
**Fix:** `ReassignTasks(fromMemberID, toMemberID, householdID)` called in RemoveMember and LeaveHousehold.

---

### 🟡 Necessary

#### NE-01 · Category not editable in TaskDrawer — `done`
#### NE-02 · No profile editing — `done`
#### NE-03 · No mPIN change — `done`
#### NE-04 · Sign-out does not invalidate JWT server-side — `done` (TTL shortened to 7 days)
#### NE-05 · Due dates on tasks — `done` (migration + full stack; overdue + due-soon indicators)
#### NE-06 · Auth endpoints have no rate limiting — `done` (10 req/min per IP)
#### NE-07 · Stats page has no empty state — `done`

---

### 🎨 UI/UX

#### Sprint 1 — `done`
UX-01 AccountMenu → bottom sheet · UX-02 Inline confirm on destructive actions ·
UX-03 TaskDrawer three-zone layout · UX-04 Task list empty state · UX-05 Bottom nav labels ·
UX-06 TaskCard 3-row hierarchy · UX-07 Checkbox micro-animation + optimistic comment send

#### Sprint 2 — `done`
UX-08 JoinPage "Sign in" button · UX-09 Stats ring excludes grocery ·
UX-10 Grocery "Hide done" rename · UX-11 AccountMenu on Grocery page ·
UX-12 Search clear (×) button · UX-13 Filter reset on empty state ·
UX-14 Grocery Spinner · UX-15 Grocery illustrated empty state ·
UX-16 Grocery tap-to-edit · UX-17 Sort label "Sort: Priority" ·
UX-18 Stats "By member" hidden when 0 members · UX-19 Stats urgency summary row

#### Sprint 3 — `done`
Due-soon amber pill on TaskCard · All-done undo toast (3 s) with household celebration state ·
Onboarding indicator for new households · Palette documentation

---

### 🎨 Design

#### DS-01 · Full UI revamp — `done`
Neutral `#f4f4f5` background · white cards · indigo `#6366f1` accent · DM Sans typography ·
SVG nav icons · tighter spacing · zinc text palette `#18181b` / `#71717a` / `#a1a1aa`

---

### 🟢 Roadmap

#### RD-00 · Task activity history — `done`
Unified activity + comment feed in TaskDrawer. `task_activities` table, 10 event kinds,
`GET /tasks/{id}/activity`. Chronological feed; activity as log lines, comments as bubbles.

#### RD-02 · Shopping list / Grocery page — `done`
`GroceryPage` — dedicated tab with check-off, hide-done toggle, inline edit, illustrated empty state.

#### RD-03 · Real-time sync (SSE) — `done`
Replaced all polling. Household + member-level channels. Hub notifies on every task/household mutation.

#### RD-04 · Shareable invite links — `done`
Token-based invite URLs. `JoinPage` resolves token → household name → auto-join or sign-up flow.

#### RD-05 · Dark mode — `done`
System preference + manual toggle, persisted per device via `themeStore`.

#### RD-16 · WhatsApp / iMessage invite deep link — `done`
Platform-specific share sheet using `navigator.share` with WhatsApp/iMessage fallback buttons.

---

## Changelog

| ID | Change | Date |
|----|--------|------|
| — | Backlog created | 2026-03-06 |
| RD-00 | Task activity history — unified feed, 10 event kinds, migration + full stack | 2026-03-06 |
| RD-03 | SSE live sync + member channels (join-request flow, no polling) | 2026-03-06 |
| BL-01 | Fixed comment author (useAuthStore) | 2026-03-06 |
| BL-02 | Promote to Admin (POST /households/members/{id}/promote + UI) | 2026-03-06 |
| BL-03 | ReassignTasks on remove/leave | 2026-03-06 |
| NE-01 | Category editable in TaskDrawer | 2026-03-06 |
| NE-02 | Profile editing (PATCH /members/me + AccountMenu) | 2026-03-06 |
| NE-03 | mPIN change (PATCH /auth/mpin + AccountMenu) | 2026-03-06 |
| NE-04 | JWT TTL shortened to 7 days | 2026-03-06 |
| NE-05 | Due dates — migration + full stack | 2026-03-06 |
| NE-06 | Rate limiting on auth endpoints (10 req/min per IP) | 2026-03-06 |
| NE-07 | Stats empty state | 2026-03-06 |
| UX-01–07 | Sprint 1 UI/UX — bottom sheet, inline confirm, TaskDrawer zones, empty state, nav labels, TaskCard hierarchy, checkbox animation | 2026-03-06 |
| DS-01 | Full UI revamp — indigo accent, neutral palette, SVG nav icons, DM Sans | 2026-03-06 |
| — | Coins + referral system — earn coins for referrals; balance + history in AccountMenu | 2026-03-07 |
| RD-05 | Dark mode — system preference + manual toggle, persisted via themeStore | 2026-03-07 |
| RD-04 | Shareable invite links — token-based JoinPage, auto-join or sign-up flow | 2026-03-07 |
| UX-08–19 | Sprint 2 UI/UX — JoinPage sign-in, stats ring fix, grocery UX, search clear, filter reset, sort label, urgency summary | 2026-03-07 |
| RD-16 | WhatsApp/iMessage share sheet for invite links | 2026-03-08 |
| — | Guest mode removed — authentication required to use the app | 2026-03-08 |
| — | Phone verified on login — phone marked verified at first successful login (no OTP/Firebase; full OTP was trialled and reverted) | 2026-03-08 |
| — | Letter avatars — first-letter colored circle replaces emoji avatars | 2026-03-08 |
| — | DB-driven feature flags — `feature_flags` table; `GET /api/v1/config`; `configStore` in frontend | 2026-03-08 |
| — | Sprint 1 UI/UX critical fixes — nullable assignee, misc fixes | 2026-03-08 |
| — | Sprint 2 UI/UX — onboarding indicator for new households, stats empty state copy fixes | 2026-03-08 |
| NE-05 | Sprint 3 — due-soon amber pill on TaskCard, all-done undo toast (3 s), palette docs | 2026-03-09 |
| — | Postman collection — 39-request v2.1 collection at `postman/HomeJira.postman_collection.json`; pre-commit hook enforces collection sync on API changes; CLAUDE.md rule 18 | 2026-03-09 |
| — | FigJam diagrams — System Architecture, Auth Flow, Task Lifecycle, Household Membership, TasksPage+TaskDrawer wireframe, Auth Screens wireframe | 2026-03-09 |
| — | Backlog migrated to GitHub Issues (issues #42–#54) | 2026-03-09 |

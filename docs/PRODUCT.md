# HomeJira — Product Documentation

> **Version:** 0.1.0 · **Last updated:** March 2026

---

## Table of Contents

1. [What is HomeJira?](#1-what-is-homejira)
2. [Who is it for?](#2-who-is-it-for)
3. [Core Concepts](#3-core-concepts)
4. [Authentication](#4-authentication)
5. [Households](#5-households)
6. [Tasks](#6-tasks)
7. [Grocery List](#7-grocery-list)
8. [Comments & Activity Feed](#8-comments--activity-feed)
9. [Member Profiles](#9-member-profiles)
10. [Real-Time Sync](#10-real-time-sync)
11. [Stats Dashboard](#11-stats-dashboard)
12. [Coins & Referrals](#12-coins--referrals)
13. [Feature Flags](#13-feature-flags)
14. [Guest Mode](#14-guest-mode)
15. [API Reference](#15-api-reference)

---

## 1. What is HomeJira?

HomeJira is a **household task management app** — think Jira, but for the people you live with.

It gives households a shared space to create, assign, track, and complete household tasks. Instead of sticky notes on the fridge, lost WhatsApp messages, or awkward "did you do the thing?" conversations, HomeJira puts everything in one place with clear ownership, priorities, and history.

The name comes from the team's belief that running a home deserves the same structured tooling that engineering teams use. Chores get priorities. Errands get assignees. Groceries get a list. Nothing falls through the cracks.

---

## 2. Who is it for?

HomeJira is built for any group of people sharing a living space and responsibilities:

- **Families** coordinating chores, errands, and shopping across family members
- **Flatmates** managing shared household duties fairly
- **Couples** splitting tasks without friction
- **Any household** that has ever asked "who was supposed to buy milk?"

The app is mobile-first, lightweight, and designed to be picked up with no onboarding — just register with a phone number, create or join a household, and start adding tasks.

---

## 3. Core Concepts

### Members
A **member** is a user account. Every member has a name, a profile color, a letter avatar (first letter of name on a colored background), and a phone number. Members authenticate with a 4-digit mPIN (similar to a phone PIN). There are no passwords or email addresses required to use the app.

### Households
A **household** is the central container. Tasks, members, and activities all belong to a household. A member can only belong to one household at a time. The person who creates the household becomes the **admin**.

### Tasks
A **task** is the fundamental unit of work. Each task has a title, category (chore, errand, repair, grocery), priority (urgent, high, normal), and an optional assignee, notes, and due date. Tasks can be toggled between open and done.

### Roles
There are two roles inside a household:
- **Admin** — full control: invite members, approve join requests, remove members, promote other admins, delete the household.
- **Member** — regular participant: create and manage tasks, view the household.

---

## 4. Authentication

HomeJira uses **phone + 4-digit mPIN** authentication — no email, no password, no app store account required.

### Registration
1. Enter your phone number.
2. If the number is not registered, you're taken to the **Create Profile** screen.
3. Enter your name, choose an emoji avatar, set a 4-digit mPIN, and confirm it.
4. Tap **Create account** — you're immediately logged in.

### Login
1. Enter your phone number.
2. Enter your 4-digit mPIN.
3. You're in.

### Security
- mPINs are **bcrypt-hashed** before storage. The raw PIN is never saved or logged.
- Authentication returns a **JWT** (JSON Web Token) with a **7-day TTL**. The token includes your member ID, name, avatar, color, and household ID.
- All protected API calls require a valid `Authorization: Bearer <token>` header.
- The server validates the token on every request and confirms the member exists in the database.

### Changing Your mPIN
From the account menu → **Change PIN**, enter your current PIN and new PIN (twice to confirm).

---

## 5. Households

A household is the shared space where all tasks and members live. You need to either create a household or join one before you can create tasks.

### Creating a Household
From the **Household** tab, tap **Create household**. Give it a name and choose a type:
- **Home** — for a family or couple sharing a home
- **Group** — for flatmates or any other group arrangement

You become the admin immediately. A unique **join code** is generated automatically.

### Joining a Household

There are three ways to join a household:

#### 1. Join via Code
Ask your household admin for the join code. Enter it in the app under **Join household**. This creates a **join request** that the admin must approve.

While your request is pending, the app shows a waiting screen. You'll be notified via real-time sync the moment the admin approves.

#### 2. Join via Shareable Link
Admins can generate a **shareable invite link** (valid for 7 days) from the Household settings. Anyone who opens the link is taken to a join page and can join directly — no approval needed. This is the fastest way to onboard someone new.

#### 3. Invite by Phone (admin-initiated)
Admins can invite a phone number directly. The invited person sees a pending invite when they open the app, and can accept or reject it.

### Leaving a Household
Any member can leave from Household settings → **Leave household**. Your open tasks are automatically reassigned to another member (preferably an admin).

**Note:** If you're the only admin, you must promote another member to admin before you can leave.

### Household Administration (Admin only)
- **Approve / Reject join requests** — manage the queue of people who want in
- **Remove a member** — kicks a member from the household; their open tasks are reassigned
- **Promote a member to admin** — give full admin rights to another member
- **Delete the household** — permanently deletes the household, all its tasks, and removes everyone's membership. This cannot be undone.

---

## 6. Tasks

Tasks are the core of HomeJira. Every task belongs to a household and optionally to a member (assignee).

### Task Fields

| Field | Description |
|-------|-------------|
| **Title** | What needs to be done |
| **Notes** | Optional longer description or instructions |
| **Category** | `chore`, `errand`, `repair`, or `grocery` |
| **Priority** | `urgent`, `high`, or `normal` |
| **Assignee** | Which member is responsible (optional) |
| **Due date** | When it should be done by (optional) |
| **Quantity** | Free-text amount (grocery items only, optional) |
| **Done** | Completed or not |

### Creating a Task
Tap the **+** button on the Tasks page. Fill in a title (required), choose a category and priority, optionally assign to a member and set a due date. Tap **Add task**.

### Task Categories

| Category | Emoji | Description |
|----------|-------|-------------|
| Grocery | 🛒 | Items to buy — shown separately in the Grocery List |
| Chore | 🧹 | Regular household maintenance |
| Errand | 📦 | Things to do outside the home |
| Repair | 🔧 | Broken things that need fixing |

### Task Priorities

| Priority | Color | Description |
|----------|-------|-------------|
| Urgent | 🔴 Red | Needs immediate attention |
| High | 🟠 Orange | Important but not on fire |
| Normal | ⚫ Grey | Standard task |

### Filtering and Sorting
The Tasks page (non-grocery tasks) supports:
- **Category tabs** — filter by chore, errand, repair, or see all
- **Status filter** — open tasks, done tasks, or all
- **My tasks toggle** — show only tasks assigned to you
- **Priority sort** — urgent first, then high, then normal
- **Recent sort** — last updated first
- **Search** — filter by task title text

### Completing a Task
Tap the checkbox on a task card to mark it done. Tap again to reopen it. The completion is recorded with a timestamp. Activity is logged.

### Editing a Task
Tap any task to open the detail drawer. From there you can:
- Edit the title and notes inline
- Change category, priority, assignee
- Set or clear the due date
- Add a comment
- Delete the task

### Deleting a Task
From the task drawer, tap the delete icon (trash). There's a confirmation step. Deleted tasks are permanently removed.

---

## 7. Grocery List

The Grocery List is a dedicated view for all tasks with the `grocery` category. It's designed to feel like a shopping list rather than a task board.

### Features
- **Quick add** — type an item at the top and tap Add (or press Enter)
- **Quantity field** — optionally set a free-text quantity (e.g. "2 litres", "6 pack") on each grocery item
- **Check off items** — tap any item to mark it as bought
- **Check all** — bulk-complete all active items in one tap
- **Inline edit** — tap an item's text to edit it in place
- **Done section** — completed items collapse into a foldable "Done" section
- **Assignee display** — each item shows the avatar of who added it
- **Delete** — swipe or tap the × on any item to remove it

### History View
Switch to **History** mode to see all completed grocery items grouped by date:
- Today
- Yesterday
- Specific dates further back

This makes it easy to recall what you bought last week or recreate a regular shopping list.

### Navigation
The Grocery List is its own tab in the bottom navigation, completely separate from the main task board. Grocery tasks do **not** appear on the Tasks page.

---

## 8. Comments & Activity Feed

Every task has a unified feed combining **comments** (written by members) and **activity events** (automatically generated by the system).

### Comments
Any member can add a comment to a task from the task drawer. Comments show:
- The author's avatar and name
- The comment text
- How long ago it was posted (relative time, e.g. "3 hours ago")

### Activity Events
The system automatically records an activity event every time a significant change happens to a task:

| Event | What triggered it |
|-------|-------------------|
| **Created** | Task was created |
| **Completed** | Task was marked done |
| **Reopened** | Task was un-checked |
| **Assigned** | Assignee changed (logs from → to) |
| **Priority changed** | Priority updated (logs from → to) |
| **Category changed** | Category updated (logs from → to) |
| **Title changed** | Title was edited |
| **Notes changed** | Notes were edited |
| **Due date set** | Due date was added or changed |
| **Due date cleared** | Due date was removed |

Activities are combined with comments into a single chronological feed in the task drawer, making it easy to see the full history of a task at a glance.

---

## 9. Member Profiles

### Profile Information
Each member has:
- **Name** — displayed throughout the app
- **Letter avatar** — first letter of name on a colored circle background (Google-style). Emoji selection during registration is stored but displayed as a letter avatar throughout the app.
- **Color** — chosen from 8 colors; used for avatar background, task indicators, and UI accents
- **Phone number** — used for authentication; shown in your own profile view

### Letter Avatars
Avatars are displayed as a colored circle with the **first letter of the member's name** — Google-style. The background color is the member's chosen profile color. This makes members immediately recognisable at a glance across task cards, comments, and member lists.

> Note: The registration screen asks for an emoji selection, which is stored in the database. The letter avatar is the canonical display format used throughout the app interface.

### Editing Your Profile
From the account menu (top-right), tap **Edit profile**:
- Change your name
- Pick a different emoji (shown in the avatar circle overlay)
- Choose a different color

Changes take effect immediately.

### Color Assignment
On registration, a color is automatically assigned from the 8-color palette by cycling through it based on how many members have registered. You can change it at any time.

### Member List
The household member list is visible on the Tasks page (first 4 members shown, "+N" for more) and in full on the Members/Household page.

---

## 10. Real-Time Sync

HomeJira uses **Server-Sent Events (SSE)** to push live updates to all household members. You don't need to refresh the app to see changes made by other members.

### How it Works
When you're in the app, your browser maintains a persistent connection to the server. When any household member makes a change (creates a task, completes one, joins the household, etc.), the server sends a notification through that connection. Your app then silently refetches the relevant data in the background.

### What Triggers a Sync
- Any task created, updated, or deleted
- A comment added to a task
- A member approved to join the household
- A member removed from the household
- Any household setting changed

### Implementation
The SSE connection authenticates via a `?token=` query parameter (since `EventSource` cannot set custom headers). The stream endpoint is `GET /api/v1/events?token=<jwt>`. The connection is kept open indefinitely — server write timeouts are disabled for this endpoint.

---

## 11. Stats Dashboard

The Stats page provides a visual summary of your household's task activity.

Accessible via the **Stats** tab in the bottom navigation.

Data is sourced from the current household's tasks and members in the Zustand store — no extra API call is needed.

*Detailed breakdown of stats charts and metrics is rendered in `StatsScreen` component.*

---

## 12. Coins & Referrals

HomeJira has a lightweight **coin economy** designed to reward members for growing the community.

> ⚠️ The coins feature is currently **disabled** by default via the feature flag system. The full implementation is in place and can be enabled.

### Earning Coins

| Action | Coins Earned |
|--------|-------------|
| Someone joins your household via your shareable invite link | **+20 coins** |
| A new user registers using your referral link | **+10 coins** |

### Referral Links
Each member can generate a unique referral link from their account menu under **Coins**. The link goes to a public page showing the referrer's profile (name, avatar, color) with a call-to-action to sign up.

When a new user registers via your referral link:
1. The referral token is stored in their browser during onboarding
2. On registration, the token is validated and 10 coins are credited to you
3. You can't refer yourself — self-referral is blocked

### Coin Balance
Your current balance and full transaction history are visible in the account menu → **Coins** sheet. Each transaction shows the reason, who triggered it, and the timestamp.

### Transaction Reasons
- `household_invite` — 20 coins when someone joins via your shareable link
- `referral` — 10 coins when a new member registers with your referral token

---

## 13. Feature Flags

HomeJira uses a **database-driven feature flag system** to toggle features on and off without a code deployment.

### How It Works
Flags are stored in the `feature_flags` database table and served to the frontend via the public `GET /api/v1/config` endpoint. The frontend fetches this at startup and makes flag state available across all components.

### Current Flags

| Flag | Default | Description |
|------|---------|-------------|
| `grocery_list` | ✅ Enabled | Grocery list tab and functionality |
| `stats` | ✅ Enabled | Stats dashboard tab |
| `coins` | ❌ Disabled | Coin earning and balance display |
| `referral_system` | ❌ Disabled | Referral link generation and processing |
| `phone_verification` | ❌ Disabled | Reserved (feature removed) |
| `email_verification` | ❌ Disabled | Reserved (feature removed) |

### Enabling a Flag
Connect to the database and run:
```sql
UPDATE feature_flags SET enabled = true WHERE key = 'coins';
```
The change takes effect on the next app load — no server restart needed.

---

## 14. Guest Mode

Users who don't want to create an account can use HomeJira in **Guest Mode** by tapping "Skip" on the auth screen.

### What Guest Mode Offers
- Full task creation and management
- All categories and priorities
- Grocery list

### How It Works
In guest mode, all data is stored locally in the browser's `localStorage`. No API calls are made for task mutations. A static guest member profile is used as the task assignee.

### Limitations
- Data exists only on the current device and browser
- No household collaboration — guest tasks are private
- No real-time sync with other members
- No coins, referrals, or activity history
- Data is lost if the browser cache is cleared

A **Guest Banner** is shown throughout the app, encouraging the user to create a free account to unlock all features and sync across devices.

---

## 15. API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/check-phone` | — | Check if a phone number is registered |
| `POST` | `/auth/login` | — | Login with phone + mPIN |
| `POST` | `/auth/register` | — | Register new member |
| `POST` | `/auth/refresh` | ✅ | Reissue JWT with latest DB state |
| `PATCH` | `/auth/mpin` | ✅ | Change mPIN |

### Config

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/config` | — | Get app feature flags |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Liveness check — commit SHA, env, DB ping, uptime, build time |

### Members

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/members` | ✅ | List all members in household |
| `PATCH` | `/members/me` | ✅ | Update own profile (name, avatar, color) |
| `GET` | `/members/{id}` | ✅ | Get member by ID |
| `GET` | `/members/me/coins` | ✅ | Get coin balance + transaction history |
| `GET` | `/members/me/referral-link` | ✅ | Get or create referral token |

### Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/tasks` | ✅ | List tasks (filterable) |
| `POST` | `/tasks` | ✅ | Create task |
| `GET` | `/tasks/{id}` | ✅ | Get task with comments |
| `PATCH` | `/tasks/{id}` | ✅ | Update task (partial) |
| `DELETE` | `/tasks/{id}` | ✅ | Delete task |
| `POST` | `/tasks/{id}/comments` | ✅ | Add comment |
| `GET` | `/tasks/{id}/activity` | ✅ | Get activity history |

### Households

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/households/me` | ✅ | Get own household |
| `POST` | `/households` | ✅ | Create household |
| `POST` | `/households/join-by-code` | ✅ | Request to join via join code |
| `POST` | `/households/leave` | ✅ | Leave household |
| `DELETE` | `/households` | ✅ Admin | Delete household |
| `POST` | `/households/invite-link` | ✅ Admin | Generate shareable invite link |
| `GET` | `/households/link/{token}` | — | Resolve invite link (public) |
| `POST` | `/households/link/{token}/join` | ✅ | Join via invite link |
| `POST` | `/households/members/{id}/remove` | ✅ Admin | Remove a member |
| `POST` | `/households/members/{id}/promote` | ✅ Admin | Promote to admin |

### Join Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/households/requests/mine` | ✅ | Get own pending join request |
| `GET` | `/households/requests` | ✅ Admin | List pending requests |
| `POST` | `/households/requests/{id}/approve` | ✅ Admin | Approve request |
| `POST` | `/households/requests/{id}/reject` | ✅ Admin | Reject request |
| `POST` | `/households/requests/{id}/cancel` | ✅ | Cancel own request |

### Household Invites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/households/invites` | ✅ Admin | Invite a phone number |
| `GET` | `/households/invites/me` | ✅ | Get pending invites for own phone |
| `POST` | `/households/invites/{id}/accept` | ✅ | Accept invite |
| `POST` | `/households/invites/{id}/reject` | ✅ | Reject invite |

### Real-Time

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/events?token=<jwt>` | token param | SSE live update stream |

### Referral

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/referral/{token}` | — | Get referrer public profile |

---

*For technical architecture and development setup, see [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md).*

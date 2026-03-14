#!/usr/bin/env bash
# QA-1: Auth + Tasks + Groceries endpoint smoke test
# Usage:
#   bash qa/test-auth-tasks.sh            # staging
#   bash qa/test-auth-tasks.sh --local    # http://localhost:8080
#
# NOTE: Auth endpoints are rate-limited at 10 req/min per IP.
# The script paces auth calls with a 65s pause between the first burst
# (check-username + register) and the second burst (login + tasks).

set -euo pipefail

# ─── environment ──────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--local" ]]; then
  BASE="http://localhost:8080"
else
  BASE="https://homejira-staging.up.railway.app"
fi
API="$BASE/api/v1"

PASS=0
FAIL=0

# Unique username using epoch suffix (alphanumeric + underscore, 3–30 chars)
TS="$(date +%s | tail -c 7)"
USERNAME="qa1bot_${TS}"
MPIN="4321"
NAME="QA Bot"
AVATAR="Q"

TOKEN=""
MEMBER_ID=""
TASK_ID=""
GROCERY_ID=""

echo "ℹ️  ENV:      $BASE"
echo "ℹ️  Username: $USERNAME"
echo ""

# ─── helpers ──────────────────────────────────────────────────────────────────

check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✅ PASS — $label"
    (( PASS++ )) || true
  else
    echo "  ❌ FAIL — $label | expected $expected got $actual"
    (( FAIL++ )) || true
  fi
}

check_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✅ PASS — $label"
    (( PASS++ )) || true
  else
    echo "  ❌ FAIL — $label | expected to contain '$needle'"
    echo "           body: $(echo "$haystack" | head -c 300)"
    (( FAIL++ )) || true
  fi
}

# Returns "STATUS|||BODY"
req() {
  local method="$1" url="$2"
  shift 2
  local tmp status body
  tmp=$(curl -s -w "\n__STATUS__:%{http_code}" -X "$method" "$url" "$@")
  status=$(echo "$tmp" | grep '__STATUS__:' | sed 's/__STATUS__://')
  body=$(echo "$tmp" | sed '/^__STATUS__:/d')
  echo "${status}|||${body}"
}

split_status() { echo "$1" | cut -d'|' -f1; }
split_body()   { echo "$1" | cut -d'|' -f4-; }

# ─── 1. SYSTEM ────────────────────────────────────────────────────────────────
echo "━━━ 1. SYSTEM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[1.1] GET /health"
r=$(req GET "$BASE/health")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"              "200"           "$s"
check_contains "status:ok"      '"status":"ok"' "$b"
check_contains "db:ok"          '"db":"ok"'     "$b"
check_contains "commit present" '"commit"'      "$b"
check_contains "uptime_sec key" '"uptime_sec"'  "$b"
check_contains "env key"        '"env"'         "$b"

echo ""
echo "[1.2] GET /api/v1/config"
r=$(req GET "$API/config")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"         "200"     "$s"
check_contains "flags key" '"flags"' "$b"

# ─── 2. AUTH GUARDS ───────────────────────────────────────────────────────────
echo ""
echo "━━━ 2. AUTH GUARDS (no token) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[2.1] GET /api/v1/tasks (no token) → expect 401"
r=$(req GET "$API/tasks")
check "status 401" "401" "$(split_status "$r")"

echo ""
echo "[2.2] POST /api/v1/tasks (no token) → expect 401"
r=$(req POST "$API/tasks" -H "Content-Type: application/json" -d '{"title":"ghost"}')
check "status 401" "401" "$(split_status "$r")"

echo ""
echo "[2.3] POST /api/v1/auth/refresh (no token) → expect 401"
r=$(req POST "$API/auth/refresh")
check "status 401" "401" "$(split_status "$r")"

# ─── 3. AUTH: check-username (2 calls — budget: 2/10) ─────────────────────────
echo ""
echo "━━━ 3. AUTH: check-username ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[3.1] POST /auth/check-username (new username)"
r=$(req POST "$API/auth/check-username" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\"}")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"                "200"               "$s"
check_contains "registered:false" '"registered":false' "$b"

echo ""
echo "[3.2] POST /auth/check-username (invalid — too short) → expect 400"
r=$(req POST "$API/auth/check-username" \
  -H "Content-Type: application/json" \
  -d '{"username":"ab"}')
s=$(split_status "$r")
check "status 400" "400" "$s"

# ─── 4. AUTH: register (1 call — budget: 3/10) ────────────────────────────────
echo ""
echo "━━━ 4. AUTH: register ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[4.1] POST /auth/register"
r=$(req POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"mpin\":\"$MPIN\",\"name\":\"$NAME\",\"avatar\":\"$AVATAR\"}")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 201"          "201"      "$s"
check_contains "has token"  '"token"'  "$b"
check_contains "has member" '"member"' "$b"
check_contains "name field" '"name"'   "$b"

TOKEN=$(echo "$b" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
MEMBER_ID=$(echo "$b" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [[ -z "$TOKEN" ]]; then
  echo "  ⚠️  Could not extract token"
else
  echo "  ℹ️  Token acquired (${#TOKEN} chars), member ID: $MEMBER_ID"
fi

echo ""
echo "[4.2] POST /auth/register (invalid username — contains space) → expect 400"
r=$(req POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"bad user","mpin":"1234","name":"Test","avatar":"T"}')
s=$(split_status "$r")
check "status 400" "400" "$s"

# budget: 4/10 — pause 65s so window fully resets before next burst
echo ""
echo "  ⏳ Pausing 65s for rate-limit window to reset..."
sleep 65

# ─── 5. AUTH: login (2 calls — new window budget: 2/10) ──────────────────────
echo ""
echo "━━━ 5. AUTH: login ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[5.1] POST /auth/login (correct mPIN)"
r=$(req POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"mpin\":\"$MPIN\"}")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"          "200"      "$s"
check_contains "has token"  '"token"'  "$b"
check_contains "has member" '"member"' "$b"
LOGIN_TOKEN=$(echo "$b" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
if [[ -n "$LOGIN_TOKEN" ]]; then TOKEN="$LOGIN_TOKEN"; fi

echo ""
echo "[5.2] POST /auth/login (wrong mPIN) → expect 401"
r=$(req POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"mpin\":\"0000\"}")
check "status 401" "401" "$(split_status "$r")"

echo ""
echo "[5.3] POST /auth/login (unknown username) → expect 401 (avoids enumeration)"
r=$(req POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"no_such_user_qa1","mpin":"1234"}')
check "status 401" "401" "$(split_status "$r")"

# ─── 6. check-username after register (1 call — budget: 4/10) ────────────────
echo ""
echo "[6.1] POST /auth/check-username (registered username)"
r=$(req POST "$API/auth/check-username" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\"}")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"               "200"              "$s"
check_contains "registered:true" '"registered":true' "$b"

# ─── 7. Duplicate register (1 call — budget: 5/10) ────────────────────────────
echo ""
echo "[7.1] POST /auth/register (duplicate username) → expect 409"
r=$(req POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"mpin\":\"$MPIN\",\"name\":\"$NAME\",\"avatar\":\"$AVATAR\"}")
check "status 409" "409" "$(split_status "$r")"

# ─── 8. AUTH: refresh & mpin (protected — not rate-limited) ──────────────────
echo ""
echo "━━━ 8. AUTH: refresh & mpin ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[8.1] POST /auth/refresh (with token)"
r=$(req POST "$API/auth/refresh" \
  -H "Authorization: Bearer $TOKEN")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"         "200"     "$s"
check_contains "has token" '"token"' "$b"

echo ""
echo "[8.2] PATCH /auth/mpin (change mPIN) → expect 204"
r=$(req PATCH "$API/auth/mpin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"current_mpin\":\"$MPIN\",\"new_mpin\":\"9876\"}")
check "status 204" "204" "$(split_status "$r")"

echo ""
echo "[8.3] PATCH /auth/mpin (wrong current mPIN) → expect 401"
r=$(req PATCH "$API/auth/mpin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_mpin":"0000","new_mpin":"1111"}')
check "status 401" "401" "$(split_status "$r")"

# Restore mPIN
req PATCH "$API/auth/mpin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"current_mpin\":\"9876\",\"new_mpin\":\"$MPIN\"}" > /dev/null 2>&1 || true

# ─── 9. SSE ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━ 9. SSE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[9.1] GET /api/v1/events?token=<jwt> → expect 200"
SSE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 3 \
  "$API/events?token=$TOKEN" 2>/dev/null || true)
check "status 200" "200" "$SSE_STATUS"

# ─── 10. TASKS — no household ─────────────────────────────────────────────────
echo ""
echo "━━━ 10. TASKS (no household context) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[10.1] GET /tasks (no household) → 200 empty list"
r=$(req GET "$API/tasks" -H "Authorization: Bearer $TOKEN")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"         "200"     "$s"
check_contains "tasks key" '"tasks"' "$b"

echo ""
echo "[10.2] POST /tasks (no household) → expect 400"
r=$(req POST "$API/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Ghost Task","category":"chore","priority":"normal"}')
check "status 400" "400" "$(split_status "$r")"

# ─── 11. Create household (prerequisite) ──────────────────────────────────────
echo ""
echo "━━━ 11. PREREQUISITE: create household ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[11.1] POST /households"
r=$(req POST "$API/households" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"QA Household","kind":"home"}')
s=$(split_status "$r"); b=$(split_body "$r")
check "status 201"             "201"         "$s"
check_contains "has household" '"household"' "$b"
check_contains "has join_code" '"join_code"' "$b"

echo ""
echo "[11.2] Re-login to get token with household context"
r=$(req POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"mpin\":\"$MPIN\"}")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200" "200" "$s"
HTOKEN=$(echo "$b" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')
if [[ -n "$HTOKEN" ]]; then
  TOKEN="$HTOKEN"
  echo "  ℹ️  Token refreshed with household context"
fi

# ─── 12. TASKS: full CRUD ─────────────────────────────────────────────────────
echo ""
echo "━━━ 12. TASKS: full CRUD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[12.1] POST /tasks (create)"
r=$(req POST "$API/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"QA Test Task","category":"chore","priority":"normal","notes":"automated qa"}')
s=$(split_status "$r"); b=$(split_body "$r")
check "status 201"              "201"         "$s"
check_contains "task key"       '"task"'      "$b"
check_contains "id field"       '"id"'        "$b"
check_contains "done:false"     '"done":false' "$b"

TASK_ID=$(echo "$b" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[[ -n "$TASK_ID" ]] && echo "  ℹ️  Task: $TASK_ID"

echo ""
echo "[12.2] GET /tasks (list)"
r=$(req GET "$API/tasks" -H "Authorization: Bearer $TOKEN")
check "status 200" "200" "$(split_status "$r")"

echo ""
echo "[12.3] GET /tasks?category=chore"
r=$(req GET "$API/tasks?category=chore" -H "Authorization: Bearer $TOKEN")
check "status 200" "200" "$(split_status "$r")"

echo ""
echo "[12.4] GET /tasks?done=false"
r=$(req GET "$API/tasks?done=false" -H "Authorization: Bearer $TOKEN")
check "status 200" "200" "$(split_status "$r")"

echo ""
echo "[12.5] GET /tasks?search=QA"
r=$(req GET "$API/tasks?search=QA" -H "Authorization: Bearer $TOKEN")
check "status 200" "200" "$(split_status "$r")"

if [[ -n "$TASK_ID" ]]; then
  echo ""
  echo "[12.6] GET /tasks/$TASK_ID"
  r=$(req GET "$API/tasks/$TASK_ID" -H "Authorization: Bearer $TOKEN")
  s=$(split_status "$r"); b=$(split_body "$r")
  check "status 200"          "200"      "$s"
  check_contains "task key"   '"task"'   "$b"
  check_contains "id matches" "$TASK_ID" "$b"

  echo ""
  echo "[12.7] PATCH /tasks/$TASK_ID (update + mark done)"
  r=$(req PATCH "$API/tasks/$TASK_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"QA Task Updated","done":true}')
  s=$(split_status "$r"); b=$(split_body "$r")
  check "status 200"             "200"              "$s"
  check_contains "updated title" '"QA Task Updated"' "$b"
  check_contains "done:true"     '"done":true'       "$b"

  echo ""
  echo "[12.8] POST /tasks/$TASK_ID/comments"
  r=$(req POST "$API/tasks/$TASK_ID/comments" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"author_id\":\"$MEMBER_ID\",\"body\":\"QA automated comment\"}")
  s=$(split_status "$r"); b=$(split_body "$r")
  check "status 201"           "201"       "$s"
  check_contains "comment key" '"comment"' "$b"

  echo ""
  echo "[12.9] GET /tasks/$TASK_ID/activity"
  r=$(req GET "$API/tasks/$TASK_ID/activity" -H "Authorization: Bearer $TOKEN")
  s=$(split_status "$r"); b=$(split_body "$r")
  check "status 200"              "200"          "$s"
  check_contains "activities key" '"activities"' "$b"

  echo ""
  echo "[12.10] DELETE /tasks/$TASK_ID"
  r=$(req DELETE "$API/tasks/$TASK_ID" -H "Authorization: Bearer $TOKEN")
  check "status 204" "204" "$(split_status "$r")"

  echo ""
  echo "[12.11] GET /tasks/$TASK_ID (after delete) → expect 404"
  r=$(req GET "$API/tasks/$TASK_ID" -H "Authorization: Bearer $TOKEN")
  check "status 404" "404" "$(split_status "$r")"
fi

# ─── 13. Task validation ──────────────────────────────────────────────────────
echo ""
echo "━━━ 13. TASK VALIDATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[13.1] GET /tasks/not-a-uuid → expect 400"
r=$(req GET "$API/tasks/not-a-uuid" -H "Authorization: Bearer $TOKEN")
check "status 400" "400" "$(split_status "$r")"

echo ""
echo "[13.2] GET /tasks/00000000-0000-0000-0000-000000000000 → expect 404"
r=$(req GET "$API/tasks/00000000-0000-0000-0000-000000000000" -H "Authorization: Bearer $TOKEN")
check "status 404" "404" "$(split_status "$r")"

echo ""
echo "[13.3] POST /tasks (missing title) → expect 422"
r=$(req POST "$API/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"chore","priority":"normal"}')
check "status 422" "422" "$(split_status "$r")"

echo ""
echo "[13.4] POST /tasks (invalid category) → expect 422"
r=$(req POST "$API/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Bad Cat Task","category":"grocery","priority":"normal"}')
check "status 422" "422" "$(split_status "$r")"

# ─── 14. GROCERIES: full CRUD ─────────────────────────────────────────────────
echo ""
echo "━━━ 14. GROCERIES: full CRUD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[14.1] POST /groceries (create)"
r=$(req POST "$API/groceries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"QA Milk","quantity":"2L","notes":"whole milk"}')
s=$(split_status "$r"); b=$(split_body "$r")
check "status 201"             "201"      "$s"
check_contains "grocery key"   '"grocery"' "$b"
check_contains "title field"   '"title"'   "$b"
check_contains "done:false"    '"done":false' "$b"

GROCERY_ID=$(echo "$b" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[[ -n "$GROCERY_ID" ]] && echo "  ℹ️  Grocery: $GROCERY_ID"

echo ""
echo "[14.2] GET /groceries (list)"
r=$(req GET "$API/groceries" -H "Authorization: Bearer $TOKEN")
s=$(split_status "$r"); b=$(split_body "$r")
check "status 200"              "200"        "$s"
check_contains "groceries key"  '"groceries"' "$b"

echo ""
echo "[14.3] GET /groceries?done=false"
r=$(req GET "$API/groceries?done=false" -H "Authorization: Bearer $TOKEN")
check "status 200" "200" "$(split_status "$r")"

echo ""
echo "[14.4] GET /groceries?search=QA"
r=$(req GET "$API/groceries?search=QA" -H "Authorization: Bearer $TOKEN")
check "status 200" "200" "$(split_status "$r")"

if [[ -n "$GROCERY_ID" ]]; then
  echo ""
  echo "[14.5] GET /groceries/$GROCERY_ID"
  r=$(req GET "$API/groceries/$GROCERY_ID" -H "Authorization: Bearer $TOKEN")
  s=$(split_status "$r"); b=$(split_body "$r")
  check "status 200"             "200"        "$s"
  check_contains "grocery key"   '"grocery"'  "$b"
  check_contains "id matches"    "$GROCERY_ID" "$b"

  echo ""
  echo "[14.6] PATCH /groceries/$GROCERY_ID (update title + mark done)"
  r=$(req PATCH "$API/groceries/$GROCERY_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"QA Milk Updated","done":true}')
  s=$(split_status "$r"); b=$(split_body "$r")
  check "status 200"             "200"                "$s"
  check_contains "updated title" '"QA Milk Updated"'  "$b"
  check_contains "done:true"     '"done":true'         "$b"

  echo ""
  echo "[14.7] POST /groceries (missing title) → expect 422"
  r=$(req POST "$API/groceries" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"quantity":"1kg"}')
  check "status 422" "422" "$(split_status "$r")"

  echo ""
  echo "[14.8] GET /groceries/not-a-uuid → expect 400"
  r=$(req GET "$API/groceries/not-a-uuid" -H "Authorization: Bearer $TOKEN")
  check "status 400" "400" "$(split_status "$r")"

  echo ""
  echo "[14.9] DELETE /groceries/$GROCERY_ID"
  r=$(req DELETE "$API/groceries/$GROCERY_ID" -H "Authorization: Bearer $TOKEN")
  check "status 204" "204" "$(split_status "$r")"

  echo ""
  echo "[14.10] GET /groceries/$GROCERY_ID (after delete) → expect 404"
  r=$(req GET "$API/groceries/$GROCERY_ID" -H "Authorization: Bearer $TOKEN")
  check "status 404" "404" "$(split_status "$r")"
fi

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS: ${PASS} passed, ${FAIL} failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL -gt 0 ]]; then exit 1; fi
exit 0

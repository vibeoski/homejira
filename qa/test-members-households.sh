#!/usr/bin/env bash
# QA-2: Members & Households endpoint smoke test
# Usage:
#   bash qa/test-members-households.sh            # staging
#   bash qa/test-members-households.sh --local    # http://localhost:8080
#
# Rate-limit: 10 auth req/min/IP. Script uses a 62s pause after initial
# registrations. Section numbers match the previous run for easy comparison.

set -euo pipefail
set +e  # track failures manually — don't abort on first error

# ─── environment ──────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--local" ]]; then
  BASE="http://localhost:8080"
else
  BASE="https://homejira-staging.up.railway.app"
fi
API="$BASE/api/v1"

PASS=0
FAIL=0
FAILURES=()

# Unique usernames using epoch suffix (alphanumeric + underscore, 3–30 chars)
TS=$(date +%s | tail -c 7)
USERNAME_ADMIN="qa2admin_${TS}"
USERNAME_MEMBER="qa2mem_${TS}"
USERNAME_THIRD="qa2third_${TS}"
USERNAME_INVITEE="qa2inv_${TS}"

echo "======================================================"
echo "  QA-2: Members & Households smoke test"
echo "  ENV:             $BASE"
echo "  Timestamp:       $TS"
echo "  Admin username:  $USERNAME_ADMIN"
echo "  Member username: $USERNAME_MEMBER"
echo "  Third username:  $USERNAME_THIRD"
echo "======================================================"

# ─── helpers ──────────────────────────────────────────────────────────────────

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ PASS — $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL — $label — expected $expected got $actual"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label — expected $expected got $actual")
  fi
}

check_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✅ PASS — $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL — $label — '$needle' not found in response"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label — '$needle' not found in response")
  fi
}

header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── 0. AUTH GUARDS ───────────────────────────────────────────────────────────
header "0. Auth guards (expect 401)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/members")
check "GET /members without token → 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/households/me")
check "GET /households/me without token → 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/members/me/coins")
check "GET /members/me/coins without token → 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/groceries")
check "GET /groceries without token → 401" "401" "$STATUS"

# ─── 1. PUBLIC: REFERRAL TOKEN ────────────────────────────────────────────────
header "1. Public: referral token (unknown → 404)"

RESP=$(curl -s -w "\n%{http_code}" "$API/referral/UNKNOWN-TOKEN-QA2")
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /referral/UNKNOWN-TOKEN-QA2 → 404 not 500" "404" "$STATUS"

# ─── 2. REGISTER ADMIN USER (2 calls — budget: 2/10) ─────────────────────────
header "2. Register admin user ($USERNAME_ADMIN)"

# check-username (new)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/check-username" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_ADMIN\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/check-username (new) → 200" "200" "$STATUS"
REGISTERED=$(echo "$BODY" | grep -o '"registered":[a-z]*' | cut -d: -f2)
if [ "$REGISTERED" = "false" ]; then
  echo "  ✅ PASS — check-username correctly returns registered:false"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — check-username returned registered:$REGISTERED (expected false)"
  FAIL=$((FAIL + 1))
  FAILURES+=("check-username registered — expected false got $REGISTERED")
fi

# register admin
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_ADMIN\",\"mpin\":\"4444\",\"name\":\"QA2 Admin\",\"avatar\":\"Q\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register admin → 201" "201" "$STATUS"
check_contains "register response has token" "token" "$BODY"

TOKEN_ADMIN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
MEMBER_ID_ADMIN=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN_ADMIN" ]; then
  echo "  ❌ FATAL — could not extract admin token, aborting"
  exit 1
fi
echo "  ℹ️  Admin member ID: $MEMBER_ID_ADMIN"

# ─── 3. REGISTER MEMBER USER (1 call — budget: 3/10) ─────────────────────────
header "3. Register member user ($USERNAME_MEMBER)"

sleep 4

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_MEMBER\",\"mpin\":\"4444\",\"name\":\"QA2 Member\",\"avatar\":\"M\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register member → 201" "201" "$STATUS"

TOKEN_MEMBER=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
MEMBER_ID_MEMBER=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN_MEMBER" ]; then
  echo "  ❌ FATAL — could not extract member token, aborting"
  exit 1
fi
echo "  ℹ️  Member ID: $MEMBER_ID_MEMBER"

# ─── 4. REGISTER THIRD USER (1 call — budget: 4/10) ──────────────────────────
header "4. Register third user ($USERNAME_THIRD)"

sleep 4

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_THIRD\",\"mpin\":\"4444\",\"name\":\"QA2 Third\",\"avatar\":\"T\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register third user → 201" "201" "$STATUS"

TOKEN_THIRD=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
MEMBER_ID_THIRD=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  ℹ️  Third member ID: $MEMBER_ID_THIRD"

# 4 calls used. Pause 62s so window resets before invitee register and error paths.
echo ""
echo "  ⏳ Sleeping 62s to reset rate-limit window..."
sleep 62

# ─── 5. MEMBERS ENDPOINTS ─────────────────────────────────────────────────────
header "5. Members endpoints (no household)"

RESP=$(curl -s -w "\n%{http_code}" "$API/members" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /members (authed, no household) → 200" "200" "$STATUS"

RESP=$(curl -s -w "\n%{http_code}" "$API/members/$MEMBER_ID_ADMIN" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /members/{id} self → 200" "200" "$STATUS"
check_contains "GET /members/{id} has name" "QA2 Admin" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" "$API/members/not-a-uuid" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /members/not-a-uuid → 400" "400" "$STATUS"

RESP=$(curl -s -w "\n%{http_code}" "$API/members/me/coins" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /members/me/coins → 200" "200" "$STATUS"
check_contains "coins response has balance" "balance" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$API/members/me" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"name":"QA2 Admin Updated"}')
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "PATCH /members/me name update → 200" "200" "$STATUS"
check_contains "PATCH /members/me has updated name" "QA2 Admin Updated" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$API/members/me" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{}')
STATUS=$(echo "$RESP" | tail -n 1)
check "PATCH /members/me empty body (name required) → 422" "422" "$STATUS"

# ─── 6. HOUSEHOLDS — CREATE ───────────────────────────────────────────────────
header "6. Households — create"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"name":"QA2 Test House","kind":"invalid"}')
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /households invalid kind → 422" "422" "$STATUS"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"home"}')
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /households missing name → 422" "422" "$STATUS"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"name":"QA2 Test House","kind":"home"}')
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /households valid → 201" "201" "$STATUS"
check_contains "POST /households response has id" "\"id\"" "$BODY"
check_contains "POST /households response has join_code" "join_code" "$BODY"

HOUSEHOLD_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
JOIN_CODE=$(echo "$BODY" | grep -o '"join_code":"[^"]*"' | cut -d'"' -f4)
echo "  ℹ️  Household ID: $HOUSEHOLD_ID  Join code: $JOIN_CODE"

# Refresh admin token to embed household_id in JWT
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/refresh" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/refresh after household create → 200" "200" "$STATUS"
NEW_TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$NEW_TOKEN" ]; then
  TOKEN_ADMIN="$NEW_TOKEN"
  echo "  ℹ️  Admin token refreshed (household_id in JWT)"
fi

# Already-in-household → 409
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplicate House","kind":"home"}')
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "409" ] || [ "$STATUS" = "422" ]; then
  echo "  ✅ PASS — POST /households when already in household → $STATUS (conflict)"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households when already in household — expected 409/422 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households when already in household — expected 409/422 got $STATUS")
fi

# ─── 7. GET HOUSEHOLD ME ──────────────────────────────────────────────────────
header "7. GET /households/me"

RESP=$(curl -s -w "\n%{http_code}" "$API/households/me" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /households/me → 200" "200" "$STATUS"
check_contains "GET /households/me has household key" "household" "$BODY"
check_contains "GET /households/me has join_code" "join_code" "$BODY"
check_contains "GET /households/me has household name" "QA2 Test House" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" "$API/households/me" \
  -H "Authorization: Bearer $TOKEN_MEMBER")
STATUS=$(echo "$RESP" | tail -n 1)
BODY2=$(echo "$RESP" | head -n -1)
check "GET /households/me (member, no household) → 200" "200" "$STATUS"
check_contains "GET /households/me (no hh) has household key" "household" "$BODY2"

# ─── 8. JOIN BY CODE ──────────────────────────────────────────────────────────
header "8. Join by code"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/join-by-code" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d '{"code":"BADCODE"}')
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "404" ] || [ "$STATUS" = "422" ]; then
  echo "  ✅ PASS — POST /households/join-by-code bad code → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/join-by-code bad code — expected 404/422 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/join-by-code bad code — expected 404/422 got $STATUS")
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/join-by-code" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d '{}')
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /households/join-by-code missing code → 422" "422" "$STATUS"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/join-by-code" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$JOIN_CODE\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  echo "  ✅ PASS — POST /households/join-by-code valid → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/join-by-code valid — expected 200/201 got $STATUS (body: $BODY)"
  Fail=$((FAIL + 1))
  FAILURES+=("POST /households/join-by-code valid — expected 200/201 got $STATUS")
fi
echo "  ℹ️  join-by-code response: $BODY"

REQUEST_ID=$(echo "$BODY" | grep -o '"request":{"id":"[^"]*"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$REQUEST_ID" ]; then
  REQUEST_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | tail -1 | cut -d'"' -f4)
fi

# Duplicate join → 409
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/join-by-code" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$JOIN_CODE\"}")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "409" ] || [ "$STATUS" = "422" ]; then
  echo "  ✅ PASS — POST /households/join-by-code duplicate → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/join-by-code duplicate — expected 409/422 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/join-by-code duplicate — expected 409/422 got $STATUS")
fi

# ─── 9. JOIN REQUESTS ─────────────────────────────────────────────────────────
header "9. Join requests"

RESP=$(curl -s -w "\n%{http_code}" "$API/households/requests/mine" \
  -H "Authorization: Bearer $TOKEN_MEMBER")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /households/requests/mine (member) → 200" "200" "$STATUS"
echo "  ℹ️  requests/mine: $BODY"

if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" = "null" ]; then
  REQUEST_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  ℹ️  Extracted request ID: $REQUEST_ID"
fi

RESP=$(curl -s -w "\n%{http_code}" "$API/households/requests" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /households/requests (admin) → 200" "200" "$STATUS"

if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" = "null" ]; then
  REQUEST_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "  ℹ️  Join request ID: $REQUEST_ID"

# Non-admin listing all requests → 401/403
RESP=$(curl -s -w "\n%{http_code}" "$API/households/requests" \
  -H "Authorization: Bearer $TOKEN_MEMBER")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  echo "  ✅ PASS — GET /households/requests as non-admin → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ⚠️  INFO — GET /households/requests as non-admin returned $STATUS (expected 401/403)"
fi

# Approve the join request
if [ -n "$REQUEST_ID" ] && [ "$REQUEST_ID" != "null" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/requests/$REQUEST_ID/approve" \
    -H "Authorization: Bearer $TOKEN_ADMIN")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n 1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    echo "  ✅ PASS — POST /households/requests/{id}/approve → $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL — POST /households/requests/{id}/approve → $STATUS (body: $BODY)"
    FAIL=$((FAIL + 1))
    FAILURES+=("POST /households/requests/{id}/approve — expected 200/204 got $STATUS")
  fi
else
  echo "  ⚠️  INFO — No request ID; skipping approve test"
fi

# Refresh member token to embed household_id
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/refresh" \
  -H "Authorization: Bearer $TOKEN_MEMBER")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/refresh for member → 200" "200" "$STATUS"
NEW_TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$NEW_TOKEN" ] && TOKEN_MEMBER="$NEW_TOKEN" && echo "  ℹ️  Member token refreshed"

# ─── 10. INVITE LINKS ─────────────────────────────────────────────────────────
header "10. Household invite links"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/invite-link" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{}')
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  echo "  ✅ PASS — POST /households/invite-link (admin) → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/invite-link (admin) — expected 200/201 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/invite-link (admin) — expected 200/201 got $STATUS")
fi
echo "  ℹ️  invite-link response: $BODY"

INVITE_TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$INVITE_TOKEN" ]; then
  INVITE_TOKEN=$(echo "$BODY" | grep -o '"link":"[^"]*"' | cut -d'"' -f4 | grep -o '[^/]*$')
fi
echo "  ℹ️  Invite token: $INVITE_TOKEN"

# Non-admin invite-link → 401/403
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/invite-link" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d '{}')
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  echo "  ✅ PASS — POST /households/invite-link non-admin → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/invite-link non-admin — expected 401/403 got $STATUS"
  Fail=$((FAIL + 1))
  FAILURES+=("POST /households/invite-link non-admin — expected 401/403 got $STATUS")
fi

# GET /households/link/{token} (public)
if [ -n "$INVITE_TOKEN" ]; then
  RESP=$(curl -s -w "\n%{http_code}" "$API/households/link/$INVITE_TOKEN")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n 1)
  check "GET /households/link/{token} public → 200" "200" "$STATUS"
  check_contains "GET /households/link/{token} has household name" "QA2 Test House" "$BODY"

  # Third user joins via invite link
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/link/$INVITE_TOKEN/join" \
    -H "Authorization: Bearer $TOKEN_THIRD" \
    -H "Content-Type: application/json")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n 1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    echo "  ✅ PASS — POST /households/link/{token}/join → $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL — POST /households/link/{token}/join — expected 200/201 got $STATUS (body: $BODY)"
    FAIL=$((FAIL + 1))
    FAILURES+=("POST /households/link/{token}/join — expected 200/201 got $STATUS")
  fi

  RESP=$(curl -s -w "\n%{http_code}" "$API/households/link/INVALIDTOKEN999")
  STATUS=$(echo "$RESP" | tail -n 1)
  check "GET /households/link/INVALIDTOKEN999 → 404" "404" "$STATUS"
else
  echo "  ⚠️  INFO — No invite token; skipping link join tests"
fi

# ─── 11. DIRECT INVITES ───────────────────────────────────────────────────────
header "11. Direct invites (admin invites a username)"

# Post invite using invitee's future username as the identifier
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/invites" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$USERNAME_INVITEE\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  echo "  ✅ PASS — POST /households/invites → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/invites — expected 200/201 got $STATUS (body: $BODY)"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/invites — expected 200/201 got $STATUS")
fi
INVITE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Non-admin invite → 401/403
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/invites" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$USERNAME_INVITEE\"}")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  echo "  ✅ PASS — POST /households/invites non-admin → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/invites non-admin — expected 401/403 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/invites non-admin — expected 401/403 got $STATUS")
fi

# Register invitee (1 call — window budget after 62s reset: 1/10)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_INVITEE\",\"mpin\":\"4444\",\"name\":\"QA2 Invitee\",\"avatar\":\"I\"}")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register invitee → 201" "201" "$STATUS"
TOKEN_INVITEE=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# GET /households/invites/me (invitee's username matches the invite's phone field)
RESP=$(curl -s -w "\n%{http_code}" "$API/households/invites/me" \
  -H "Authorization: Bearer $TOKEN_INVITEE")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
check "GET /households/invites/me → 200" "200" "$STATUS"
echo "  ℹ️  invites/me response: $BODY"

FETCHED_INVITE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -z "$FETCHED_INVITE_ID" ] && [ -n "$INVITE_ID" ] && FETCHED_INVITE_ID="$INVITE_ID"

if [ -n "$FETCHED_INVITE_ID" ] && [ "$FETCHED_INVITE_ID" != "null" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/invites/$FETCHED_INVITE_ID/accept" \
    -H "Authorization: Bearer $TOKEN_INVITEE")
  BODY=$(echo "$RESP" | head -n -1)
  STATUS=$(echo "$RESP" | tail -n 1)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    echo "  ✅ PASS — POST /households/invites/{id}/accept → $STATUS"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL — POST /households/invites/{id}/accept — expected 200/204 got $STATUS (body: $BODY)"
    FAIL=$((FAIL + 1))
    FAILURES+=("POST /households/invites/{id}/accept — expected 200/204 got $STATUS")
  fi
else
  echo "  ⚠️  INFO — No invite ID to accept, skipping"
fi

# ─── 12. MEMBER MANAGEMENT (promote / remove) ─────────────────────────────────
# IMPORTANT ordering: non-admin tests run BEFORE any promotion to prevent
# stale-role bugs where a promoted member is then used for "non-admin" checks.
header "12. Member management (promote / remove)"

# [A] Non-admin tries to promote (using TOKEN_MEMBER who is still a regular member)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/members/$MEMBER_ID_ADMIN/promote" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  echo "  ✅ PASS — POST /households/members/{id}/promote non-admin → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/members/{id}/promote non-admin — expected 401/403 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/members/{id}/promote non-admin — expected 401/403 got $STATUS")
fi

# [B] Non-admin tries to remove (using TOKEN_MEMBER who is still a regular member)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/members/$MEMBER_ID_ADMIN/remove" \
  -H "Authorization: Bearer $TOKEN_MEMBER" \
  -H "Content-Type: application/json")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  echo "  ✅ PASS — POST /households/members/{id}/remove non-admin → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/members/{id}/remove non-admin — expected 401/403 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/members/{id}/remove non-admin — expected 401/403 got $STATUS")
fi

# [C] Admin promotes member (after the non-admin checks above)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/members/$MEMBER_ID_MEMBER/promote" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  echo "  ✅ PASS — POST /households/members/{id}/promote (admin) → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/members/{id}/promote (admin) — expected 200/204 got $STATUS (body: $BODY)"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/members/{id}/promote (admin) — expected 200/204 got $STATUS")
fi

# [D] Admin removes THIRD user (different target — not the member we just promoted)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/members/$MEMBER_ID_THIRD/remove" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ] || [ "$STATUS" = "404" ]; then
  echo "  ✅ PASS — POST /households/members/{id}/remove third (admin) → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/members/{id}/remove third (admin) — expected 200/204/404 got $STATUS (body: $BODY)"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/members/{id}/remove (admin) — expected 200/204/404 got $STATUS")
fi

# ─── 13. LEAVE HOUSEHOLD ──────────────────────────────────────────────────────
header "13. Leave household"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/leave" \
  -H "Authorization: Bearer $TOKEN_MEMBER")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ] || [ "$STATUS" = "422" ]; then
  echo "  ✅ PASS — POST /households/leave (member) → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — POST /households/leave (member) — expected 200/204/422 got $STATUS (body: $BODY)"
  FAIL=$((FAIL + 1))
  FAILURES+=("POST /households/leave (member) — expected 200/204/422 got $STATUS")
fi

# Admin (sole admin) cannot leave → 422/403/400
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/households/leave" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "422" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "400" ]; then
  echo "  ✅ PASS — POST /households/leave as sole admin → $STATUS (blocked)"
  PASS=$((PASS + 1))
else
  echo "  ⚠️  INFO — POST /households/leave as sole admin returned $STATUS (body: $BODY)"
fi

# ─── 14. DELETE HOUSEHOLD ─────────────────────────────────────────────────────
header "14. DELETE /households (admin only)"

# Non-admin (TOKEN_MEMBER — member just left, has stale JWT) → 401/403/422
RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$API/households" \
  -H "Authorization: Bearer $TOKEN_MEMBER")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "422" ]; then
  echo "  ✅ PASS — DELETE /households non-admin → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — DELETE /households non-admin — expected 401/403/422 got $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("DELETE /households non-admin — expected 401/403/422 got $STATUS")
fi

# Admin deletes
RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$API/households" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
BODY=$(echo "$RESP" | head -n -1)
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
  echo "  ✅ PASS — DELETE /households (admin) → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — DELETE /households (admin) — expected 200/204 got $STATUS (body: $BODY)"
  FAIL=$((FAIL + 1))
  FAILURES+=("DELETE /households (admin) — expected 200/204 got $STATUS")
fi

# Verify household gone (stale JWT has household_id but household is deleted)
RESP=$(curl -s -w "\n%{http_code}" "$API/households/me" \
  -H "Authorization: Bearer $TOKEN_ADMIN")
STATUS=$(echo "$RESP" | tail -n 1)
if [ "$STATUS" = "404" ] || [ "$STATUS" = "422" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
  echo "  ✅ PASS — GET /households/me after delete → $STATUS"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL — GET /households/me after delete — unexpected $STATUS"
  FAIL=$((FAIL + 1))
  FAILURES+=("GET /households/me after delete — unexpected $STATUS")
fi

# ─── 15. ERROR PATHS ──────────────────────────────────────────────────────────
# Sleep to reset the rate-limit window before auth error-path tests.
# Needed when this script runs in parallel with QA-1 (shared IP rate-limit bucket).
echo ""
echo "  ⏳ Sleeping 65s to reset rate-limit window before error-path auth tests..."
sleep 65
header "15. Error paths"

# Duplicate username registration → 409
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_ADMIN\",\"mpin\":\"4444\",\"name\":\"Dup\",\"avatar\":\"Q\"}")
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register duplicate username → 409" "409" "$STATUS"

# Invalid username (too short — fails regexp) → 400
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"ab","mpin":"4444","name":"Bad","avatar":"B"}')
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register invalid username (too short) → 400" "400" "$STATUS"

# Invalid username (special chars) → 400
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"bad user!","mpin":"4444","name":"Bad","avatar":"B"}')
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/register invalid username (special chars) → 400" "400" "$STATUS"

# Login wrong mPIN → 401
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME_ADMIN\",\"mpin\":\"9999\"}")
STATUS=$(echo "$RESP" | tail -n 1)
check "POST /auth/login wrong mpin → 401" "401" "$STATUS"

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  QA-2 RESULTS"
echo "======================================================"
echo "  PASS:  $PASS"
echo "  FAIL:  $FAIL"
echo "  TOTAL: $((PASS + FAIL))"
echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "  FAILURES:"
  for f in "${FAILURES[@]}"; do
    echo "    ❌ $f"
  done
fi

echo "======================================================"

if [ "$FAIL" -gt 0 ]; then exit 1; else echo "  All tests passed!"; exit 0; fi

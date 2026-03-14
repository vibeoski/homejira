#!/bin/bash
set -a
. ./backend/.env
set +a

# API Base URL (Local Developer Environment)
API_URL="http://localhost:8080/api/v1"

echo "=== HomeJira IDOR Security Test (Local) ==="

# 1. Create User A, log in, get JWT, get Household ID
echo "Registering User A via Auth..."
A_JSON=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+15550000001", "name": "AliceLocal", "avatar": "👩", "mpin": "1234"}')
A_TOKEN=$(echo "$A_JSON" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("token", ""))')
A_ID=$(echo "$A_JSON" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("member", {}).get("id", ""))')

echo "Creating Household for User A..."
A_HH=$(curl -s -X POST "$API_URL/households" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Home Local", "kind": "family"}')
A_HH_ID=$(echo "$A_HH" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("household", {}).get("id", ""))')

# 2. Setup User B in a different Household
echo "Registering User B via Auth..."
B_JSON=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+15550000002", "name": "BobLocal", "avatar": "👨", "mpin": "5678"}')
B_TOKEN=$(echo "$B_JSON" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("token", ""))')
B_ID=$(echo "$B_JSON" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("member", {}).get("id", ""))')

echo "Creating Household for User B..."
B_HH=$(curl -s -X POST "$API_URL/households" \
  -H "Authorization: Bearer $B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob Home Local", "kind": "partner"}')
B_HH_ID=$(echo "$B_HH" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("household", {}).get("id", ""))')

echo "Logging in User B again (to get household claim in JWT)..."
B_LOGIN2=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"+15550000002\", \"mpin\": \"5678\"}")
B_TOKEN=$(echo "$B_LOGIN2" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("token", ""))')

# 3. Create a Task as User A
echo "Creating a Task for User A..."
TASK_JSON=$(curl -s -X POST "$API_URL/tasks" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Alice secret task\", \"category\": \"chore\", \"priority\": \"normal\", \"assignee_id\": \"$A_ID\"}")
TASK_ID=$(echo "$TASK_JSON" | python3 -c 'import sys, json; print(json.load(sys.stdin).get("task", {}).get("id", ""))')

# 4. Attempt IDOR Attacks as User B
echo ""
echo "==== STARTING IDOR TESTS AS USER B AGAINST USER A'S DATA ===="

echo "Test 1: Can User B read User A's profile via GET /members/{id}?"
curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/members/$A_ID" \
  -H "Authorization: Bearer $B_TOKEN"

echo ""
echo "Test 2: Can User B read User A's task via GET /tasks/{id}?"
curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/tasks/$TASK_ID" \
  -H "Authorization: Bearer $B_TOKEN"

echo ""
echo "Test 3: Can User B modify User A's task via PATCH /tasks/{id}?"
curl -s -o /dev/null -w "%{http_code}" -X PATCH "$API_URL/tasks/$TASK_ID" \
  -H "Authorization: Bearer $B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked by Bob"}'

echo ""
echo "Test 4: Can User B read User A's task activity via GET /tasks/{id}/activity?"
curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/tasks/$TASK_ID/activity" \
  -H "Authorization: Bearer $B_TOKEN"

echo ""
echo "Test 5: Can User B comment on User A's task via POST /tasks/{id}/comments?"
curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/tasks/$TASK_ID/comments" \
  -H "Authorization: Bearer $B_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"author_id\": \"$B_ID\", \"body\": \"Sneaky comment from Bob\"}"

echo ""
echo "Test 6: Can User B delete User A's task via DELETE /tasks/{id}?"
curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_URL/tasks/$TASK_ID" \
  -H "Authorization: Bearer $B_TOKEN"

echo ""
echo "==== DONE ===="

#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ITEM_ID=""

cleanup() {
  if [ -n "$ITEM_ID" ]; then
    curl -fsS -X DELETE "$BASE_URL/api/items/$ITEM_ID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

printf 'Waiting for API at %s...\n' "$BASE_URL"
attempt=0
until curl -fsS "$BASE_URL/api/health" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo 'API did not become healthy.' >&2
    exit 1
  fi
  sleep 1
done

echo 'Creating item...'
response="$(curl -fsS -X POST "$BASE_URL/api/items" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test","description":"Temporary record","price":10000,"quantity":1}')"
ITEM_ID="$(printf '%s' "$response" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')"

if [ -z "$ITEM_ID" ]; then
  echo "Could not extract item ID from response: $response" >&2
  exit 1
fi

printf 'Created item ID %s. Reading...\n' "$ITEM_ID"
curl -fsS "$BASE_URL/api/items/$ITEM_ID" >/dev/null

echo 'Updating item...'
curl -fsS -X PUT "$BASE_URL/api/items/$ITEM_ID" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test Updated","description":"Temporary record","price":15000,"quantity":2}' >/dev/null

echo 'Deleting item...'
curl -fsS -X DELETE "$BASE_URL/api/items/$ITEM_ID" >/dev/null
ITEM_ID=""

echo 'Smoke test passed.'

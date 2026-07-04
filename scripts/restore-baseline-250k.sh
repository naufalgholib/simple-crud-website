#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SQL_FILE="$PROJECT_DIR/database/baseline-250k.sql"

cd "$PROJECT_DIR"

if [ ! -f "$SQL_FILE" ]; then
  echo "Baseline SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if ! docker compose ps --status running database | grep -q crud-database; then
  echo "Database container is not running. Start it with: docker compose up -d database" >&2
  exit 1
fi

cat <<'EOF'
WARNING: this operation deletes all existing rows from crud_db.items
and replaces them with the deterministic 250,000-row benchmark baseline.
EOF

if [ "${FORCE:-0}" != "1" ]; then
  printf 'Continue? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo 'Cancelled.'; exit 0 ;;
  esac
fi

echo 'Importing the 250,000-row baseline...'
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" crud_db' \
  < "$SQL_FILE"

echo 'Verifying baseline...'
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e \
   "SELECT COUNT(*), MIN(id), MAX(id) FROM crud_db.items;"'

echo 'Baseline restore completed. Expected result: 250000  1  250000'

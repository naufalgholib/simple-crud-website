#!/usr/bin/env sh
set -eu

TARGET_ROWS=50000
NEXT_AUTO_INCREMENT=$((TARGET_ROWS + 1))

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if ! docker compose ps --status running database | grep -q crud-database; then
  echo "Database container is not running. Start it with: docker compose up -d database" >&2
  exit 1
fi

cat <<EOF
WARNING: this operation deletes all existing rows from crud_db.items
and replaces them with the deterministic ${TARGET_ROWS}-row benchmark baseline.
EOF

if [ "${FORCE:-0}" != "1" ]; then
  printf 'Continue? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo 'Cancelled.'; exit 0 ;;
  esac
fi

echo "Generating the ${TARGET_ROWS}-row baseline..."
docker compose exec -T database sh -ec \
  'mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" crud_db' <<EOF
SET NAMES utf8mb4;
USE crud_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE items;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO items (
  id,
  name,
  description,
  price,
  quantity,
  created_at,
  updated_at
)
SELECT
  sequence.id,
  CONCAT('Benchmark Item ', LPAD(sequence.id, 6, '0')) AS name,
  RPAD(
    CONCAT('Deterministic benchmark row ', LPAD(sequence.id, 6, '0'), ' '),
    256,
    CHAR(65 + MOD(sequence.id, 26))
  ) AS description,
  CAST(10000 + MOD(sequence.id * 7919, 9990000) AS DECIMAL(12,2)) AS price,
  MOD(sequence.id * 37, 1000) AS quantity,
  DATE_ADD('2026-01-01 00:00:00', INTERVAL MOD(sequence.id, 2678400) SECOND) AS created_at,
  DATE_ADD('2026-01-01 00:00:00', INTERVAL MOD(sequence.id, 2678400) SECOND) AS updated_at
FROM (
  SELECT
    1
      + hundred_thousands.n * 100000
      + ten_thousands.n * 10000
      + thousands.n * 1000
      + hundreds.n * 100
      + tens.n * 10
      + ones.n AS id
  FROM
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2) AS hundred_thousands
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
     UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS ten_thousands
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
     UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS thousands
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
     UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS hundreds
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
     UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS tens
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
     UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS ones
) AS sequence
WHERE sequence.id <= ${TARGET_ROWS}
ORDER BY sequence.id;

ALTER TABLE items AUTO_INCREMENT = ${NEXT_AUTO_INCREMENT};
ANALYZE TABLE items;

SELECT
  COUNT(*) AS total_rows,
  MIN(id) AS minimum_id,
  MAX(id) AS maximum_id
FROM items;

SELECT AUTO_INCREMENT
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'items';
EOF

echo "Baseline restore completed. Expected result: ${TARGET_ROWS}  1  ${TARGET_ROWS}"
echo "Expected AUTO_INCREMENT: ${NEXT_AUTO_INCREMENT}"

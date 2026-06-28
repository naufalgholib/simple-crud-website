-- Deterministic 200,000-row baseline for read-only and mixed workloads.
--
-- WARNING: importing this file TRUNCATES crud_db.items first.
-- The generated primary keys are continuous from 1 through 200000.
-- The payload is deterministic so every VM receives the same dataset.

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
    (SELECT 0 AS n UNION ALL SELECT 1) AS hundred_thousands
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
ORDER BY sequence.id;

ALTER TABLE items AUTO_INCREMENT = 200001;
ANALYZE TABLE items;

SELECT
  COUNT(*) AS total_rows,
  MIN(id) AS minimum_id,
  MAX(id) AS maximum_id,
  AUTO_INCREMENT
FROM items
JOIN information_schema.tables
  ON table_schema = DATABASE()
 AND table_name = 'items';

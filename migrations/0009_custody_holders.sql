CREATE TABLE IF NOT EXISTS custody_holders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO payment_methods(name, note, active, created_at)
VALUES('عهدة', 'أموال في عهدة شخص', 1, '2026-07-03T00:00:00.000Z');

INSERT OR IGNORE INTO custody_holders(name, normalized_name, active, created_at, updated_at)
SELECT
  MIN(clean_name) AS name,
  normalized_name,
  1,
  '2026-07-03T00:00:00.000Z',
  '2026-07-03T00:00:00.000Z'
FROM (
  SELECT
    TRIM(SUBSTR(payment_method, 8)) AS clean_name,
    LOWER(TRIM(SUBSTR(payment_method, 8))) AS normalized_name
  FROM collections
  WHERE payment_method LIKE 'عهدة - %'
  UNION ALL
  SELECT
    TRIM(SUBSTR(source_method, 8)) AS clean_name,
    LOWER(TRIM(SUBSTR(source_method, 8))) AS normalized_name
  FROM transfers
  WHERE source_method LIKE 'عهدة - %'
  UNION ALL
  SELECT
    TRIM(SUBSTR(target_method, 8)) AS clean_name,
    LOWER(TRIM(SUBSTR(target_method, 8))) AS normalized_name
  FROM transfers
  WHERE target_method LIKE 'عهدة - %'
)
WHERE clean_name <> ''
GROUP BY normalized_name;

CREATE INDEX IF NOT EXISTS idx_custody_holders_name ON custody_holders(name);
CREATE INDEX IF NOT EXISTS idx_custody_holders_normalized ON custody_holders(normalized_name);

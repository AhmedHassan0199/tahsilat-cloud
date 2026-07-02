CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE collections ADD COLUMN customer_id INTEGER REFERENCES customers(id);

INSERT OR IGNORE INTO customers(name, normalized_name, active, created_at, updated_at)
SELECT
  MIN(clean_name) AS name,
  normalized_name,
  1,
  '2026-07-02T00:00:00.000Z',
  '2026-07-02T00:00:00.000Z'
FROM (
  SELECT
    TRIM(REPLACE(REPLACE(REPLACE(client_name, CHAR(160), ' '), '  ', ' '), '  ', ' ')) AS clean_name,
    LOWER(TRIM(REPLACE(REPLACE(REPLACE(client_name, CHAR(160), ' '), '  ', ' '), '  ', ' '))) AS normalized_name
  FROM collections
  WHERE TRIM(COALESCE(client_name, '')) <> ''
)
WHERE clean_name <> ''
GROUP BY normalized_name;

UPDATE collections
SET customer_id = (
  SELECT customers.id
  FROM customers
  WHERE customers.normalized_name = LOWER(TRIM(REPLACE(REPLACE(REPLACE(collections.client_name, CHAR(160), ' '), '  ', ' '), '  ', ' ')))
  LIMIT 1
)
WHERE customer_id IS NULL AND TRIM(COALESCE(client_name, '')) <> '';

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_normalized ON customers(normalized_name);
CREATE INDEX IF NOT EXISTS idx_collections_customer ON collections(customer_id);

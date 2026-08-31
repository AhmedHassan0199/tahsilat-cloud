CREATE TABLE IF NOT EXISTS customer_opening_balances (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  opening_balance REAL NOT NULL DEFAULT 0,
  effective_date TEXT NOT NULL DEFAULT '2026-09-01',
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO customer_opening_balances(customer_id, opening_balance, effective_date, updated_by, updated_at)
SELECT id, 0, '2026-09-01', NULL, CURRENT_TIMESTAMP
FROM customers
WHERE active = 1 AND COALESCE(is_transient, 0) = 0;

CREATE INDEX IF NOT EXISTS idx_customer_opening_balances_date
ON customer_opening_balances(effective_date);

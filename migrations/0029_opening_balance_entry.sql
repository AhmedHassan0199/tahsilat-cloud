ALTER TABLE customer_opening_balances ADD COLUMN is_set INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_opening_balances ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE customer_opening_balances ADD COLUMN created_at TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_opening_balances_is_set
ON customer_opening_balances(is_set);

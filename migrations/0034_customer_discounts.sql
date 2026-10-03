CREATE TABLE IF NOT EXISTS customer_discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_date TEXT NOT NULL,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_discounts_date ON customer_discounts(discount_date);
CREATE INDEX IF NOT EXISTS idx_customer_discounts_invoice ON customer_discounts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_discounts_customer ON customer_discounts(customer_id);

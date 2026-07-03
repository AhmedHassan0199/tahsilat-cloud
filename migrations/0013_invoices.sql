CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_date TEXT,
  delivery_note_id INTEGER NOT NULL REFERENCES delivery_notes(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  delivery_charge REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  delivery_note_item_id INTEGER NOT NULL REFERENCES delivery_note_items(id),
  line_no INTEGER NOT NULL,
  product_type TEXT NOT NULL,
  design_id INTEGER,
  design_name TEXT,
  size_id INTEGER,
  size_name TEXT,
  quantity_unit TEXT NOT NULL,
  quantity_amount REAL NOT NULL,
  supply_order_id INTEGER REFERENCES supply_orders(id),
  price_type TEXT NOT NULL,
  unit_price REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_delivery_note ON invoices(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

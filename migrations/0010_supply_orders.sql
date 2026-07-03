CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supply_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_date TEXT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  design_id INTEGER REFERENCES designs(id),
  design_name TEXT NOT NULL,
  size_id INTEGER REFERENCES product_sizes(id),
  size_name TEXT NOT NULL,
  material_id INTEGER REFERENCES materials(id),
  material_name TEXT NOT NULL,
  quantity_unit TEXT NOT NULL,
  quantity_amount REAL NOT NULL,
  price_without_cover REAL NOT NULL DEFAULT 0,
  price_with_cover REAL NOT NULL DEFAULT 0,
  delivery_cost_party TEXT NOT NULL,
  supply_date TEXT,
  print_approval_status TEXT,
  cylinder_colors_count TEXT,
  delivery_duration TEXT,
  payment_method TEXT,
  delivery_place TEXT,
  policies TEXT,
  customer_signature TEXT,
  planning_signature TEXT,
  chairman_signature TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supply_orders_date ON supply_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_supply_orders_customer ON supply_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_designs_normalized ON designs(normalized_name);
CREATE INDEX IF NOT EXISTS idx_product_sizes_normalized ON product_sizes(normalized_name);
CREATE INDEX IF NOT EXISTS idx_materials_normalized ON materials(normalized_name);

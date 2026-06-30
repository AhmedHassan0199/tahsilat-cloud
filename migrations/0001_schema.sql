CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT,
  month INTEGER,
  responsible TEXT NOT NULL,
  client_name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'غير محدد',
  note TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT,
  month INTEGER,
  expense_type TEXT NOT NULL DEFAULT 'مصروف',
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'غير محدد',
  deducted_from_treasury INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id INTEGER,
  before_data TEXT,
  after_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_collections_date ON collections(entry_date);
CREATE INDEX IF NOT EXISTS idx_collections_month ON collections(month);
CREATE INDEX IF NOT EXISTS idx_collections_client ON collections(client_name);
CREATE INDEX IF NOT EXISTS idx_collections_method ON collections(payment_method);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(entry_date);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(month);
CREATE INDEX IF NOT EXISTS idx_expenses_method ON expenses(payment_method);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

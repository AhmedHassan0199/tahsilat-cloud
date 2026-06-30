CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT,
  source_method TEXT NOT NULL,
  target_method TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(entry_date);
CREATE INDEX IF NOT EXISTS idx_transfers_source ON transfers(source_method);
CREATE INDEX IF NOT EXISTS idx_transfers_target ON transfers(target_method);

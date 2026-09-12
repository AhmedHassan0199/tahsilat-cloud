ALTER TABLE delivery_notes ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE delivery_note_items ADD COLUMN required_quantity_amount REAL;

CREATE TABLE cover_delivery_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_note_id INTEGER NOT NULL REFERENCES delivery_notes(id),
  delivery_note_item_id INTEGER NOT NULL REFERENCES delivery_note_items(id),
  delivery_date TEXT NOT NULL,
  quantity_amount REAL NOT NULL CHECK(quantity_amount > 0),
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_cover_delivery_events_note ON cover_delivery_events(delivery_note_id);
CREATE INDEX idx_cover_delivery_events_item ON cover_delivery_events(delivery_note_item_id);

-- The feature starts with newly-created delivery notes only. Every existing
-- record remains completed until the business supplies an explicit list.
UPDATE delivery_notes SET fulfillment_status = 'completed';

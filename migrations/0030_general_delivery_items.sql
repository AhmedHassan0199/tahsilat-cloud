ALTER TABLE delivery_note_items ADD COLUMN is_general INTEGER NOT NULL DEFAULT 0;
ALTER TABLE delivery_note_items ADD COLUMN general_price_type TEXT;
ALTER TABLE delivery_note_items ADD COLUMN general_unit_price REAL;


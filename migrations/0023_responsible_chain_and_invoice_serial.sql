ALTER TABLE supply_orders ADD COLUMN responsible TEXT;
ALTER TABLE delivery_note_items ADD COLUMN supply_order_id INTEGER REFERENCES supply_orders(id);
ALTER TABLE invoices ADD COLUMN responsible TEXT;
ALTER TABLE invoices ADD COLUMN serial_total REAL NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN serial_color_price REAL NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN serial_colors_count REAL NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN serial_total REAL NOT NULL DEFAULT 0;

UPDATE delivery_note_items
SET supply_order_id = (
  SELECT invoice_items.supply_order_id
  FROM invoice_items
  WHERE invoice_items.delivery_note_item_id = delivery_note_items.id
    AND invoice_items.supply_order_id IS NOT NULL
  LIMIT 1
)
WHERE supply_order_id IS NULL;

UPDATE supply_orders
SET responsible = (
  SELECT delivery_notes.responsible
  FROM invoice_items
  JOIN invoices ON invoices.id = invoice_items.invoice_id
  JOIN delivery_notes ON delivery_notes.id = invoices.delivery_note_id
  WHERE invoice_items.supply_order_id = supply_orders.id
    AND delivery_notes.responsible IS NOT NULL
    AND TRIM(delivery_notes.responsible) <> ''
  ORDER BY invoices.id DESC
  LIMIT 1
)
WHERE responsible IS NULL;

UPDATE invoices
SET responsible = (
  SELECT delivery_notes.responsible
  FROM delivery_notes
  WHERE delivery_notes.id = invoices.delivery_note_id
)
WHERE responsible IS NULL;

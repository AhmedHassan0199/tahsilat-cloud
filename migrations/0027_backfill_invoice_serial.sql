-- Backfill serial charges for invoices created before serial fields were
-- introduced. A serial charge is applied once per supply order per invoice.
INSERT INTO audit_logs (
  username, action, table_name, record_id, before_data, after_data, created_at
)
SELECT
  'system',
  'BACKFILL_SERIAL_FROM_SUPPLY_ORDER',
  'invoices',
  invoices.id,
  json_object(
    'serial_total', invoices.serial_total,
    'total', invoices.total
  ),
  json_object(
    'source', 'linked_supply_orders_with_serial_price'
  ),
  datetime('now')
FROM invoices
WHERE EXISTS (
  SELECT 1
  FROM invoice_items
  JOIN supply_orders ON supply_orders.id = invoice_items.supply_order_id
  WHERE invoice_items.invoice_id = invoices.id
    AND supply_orders.serial_color_price > 0
    AND invoice_items.serial_total = 0
);

UPDATE invoice_items
SET
  serial_color_price = CASE
    WHEN id = (
      SELECT MIN(first_item.id)
      FROM invoice_items first_item
      WHERE first_item.invoice_id = invoice_items.invoice_id
        AND first_item.supply_order_id = invoice_items.supply_order_id
    ) THEN COALESCE((
      SELECT supply_orders.serial_color_price
      FROM supply_orders
      WHERE supply_orders.id = invoice_items.supply_order_id
    ), 0)
    ELSE 0
  END,
  serial_colors_count = CASE
    WHEN id = (
      SELECT MIN(first_item.id)
      FROM invoice_items first_item
      WHERE first_item.invoice_id = invoice_items.invoice_id
        AND first_item.supply_order_id = invoice_items.supply_order_id
    ) THEN COALESCE((
      SELECT CASE
        WHEN TRIM(COALESCE(supply_orders.cylinder_colors_count, '')) GLOB '[0-9]*'
          AND CAST(supply_orders.cylinder_colors_count AS REAL) > 0
        THEN CAST(supply_orders.cylinder_colors_count AS REAL)
        ELSE 1
      END
      FROM supply_orders
      WHERE supply_orders.id = invoice_items.supply_order_id
    ), 0)
    ELSE 0
  END,
  serial_total = CASE
    WHEN id = (
      SELECT MIN(first_item.id)
      FROM invoice_items first_item
      WHERE first_item.invoice_id = invoice_items.invoice_id
        AND first_item.supply_order_id = invoice_items.supply_order_id
    ) THEN COALESCE((
      SELECT supply_orders.serial_color_price * CASE
        WHEN TRIM(COALESCE(supply_orders.cylinder_colors_count, '')) GLOB '[0-9]*'
          AND CAST(supply_orders.cylinder_colors_count AS REAL) > 0
        THEN CAST(supply_orders.cylinder_colors_count AS REAL)
        ELSE 1
      END
      FROM supply_orders
      WHERE supply_orders.id = invoice_items.supply_order_id
    ), 0)
    ELSE 0
  END
WHERE supply_order_id IN (
  SELECT id FROM supply_orders WHERE serial_color_price > 0
);

UPDATE invoices
SET
  serial_total = COALESCE((
    SELECT SUM(invoice_items.serial_total)
    FROM invoice_items
    WHERE invoice_items.invoice_id = invoices.id
  ), 0),
  total = subtotal + delivery_charge + COALESCE((
    SELECT SUM(invoice_items.serial_total)
    FROM invoice_items
    WHERE invoice_items.invoice_id = invoices.id
  ), 0),
  updated_at = datetime('now')
WHERE EXISTS (
  SELECT 1
  FROM invoice_items
  JOIN supply_orders ON supply_orders.id = invoice_items.supply_order_id
  WHERE invoice_items.invoice_id = invoices.id
    AND supply_orders.serial_color_price > 0
);

UPDATE audit_logs
SET after_data = json_set(
  after_data,
  '$.serial_total', (SELECT invoices.serial_total FROM invoices WHERE invoices.id = audit_logs.record_id),
  '$.total', (SELECT invoices.total FROM invoices WHERE invoices.id = audit_logs.record_id)
)
WHERE action = 'BACKFILL_SERIAL_FROM_SUPPLY_ORDER'
  AND table_name = 'invoices'
  AND json_extract(after_data, '$.serial_total') IS NULL;

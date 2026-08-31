-- Synchronize legacy delivery notes and invoices with the responsible stored
-- on their linked supply orders. Only chains with one unambiguous canonical
-- supply-order responsible are eligible.
INSERT INTO audit_logs (
  username,
  action,
  table_name,
  record_id,
  before_data,
  after_data,
  created_at
)
SELECT
  'system',
  'SYNC_RESPONSIBLE_FROM_SUPPLY_ORDER',
  'delivery_notes',
  delivery_notes.id,
  json_object('responsible', delivery_notes.responsible),
  json_object(
    'responsible', MIN(supply_orders.responsible),
    'source', 'linked_supply_orders'
  ),
  datetime('now')
FROM delivery_notes
JOIN delivery_note_items
  ON delivery_note_items.delivery_note_id = delivery_notes.id
JOIN supply_orders
  ON supply_orders.id = delivery_note_items.supply_order_id
WHERE supply_orders.responsible IN (
    'ا/ نورا السيد',
    'ا/ محمد حسن',
    'الشركة المصرية'
  )
GROUP BY delivery_notes.id
HAVING COUNT(DISTINCT supply_orders.responsible) = 1
   AND COALESCE(delivery_notes.responsible, '') <> MIN(supply_orders.responsible);

UPDATE delivery_notes
SET responsible = (
  SELECT MIN(supply_orders.responsible)
  FROM delivery_note_items
  JOIN supply_orders
    ON supply_orders.id = delivery_note_items.supply_order_id
  WHERE delivery_note_items.delivery_note_id = delivery_notes.id
    AND supply_orders.responsible IN (
      'ا/ نورا السيد',
      'ا/ محمد حسن',
      'الشركة المصرية'
    )
)
WHERE 1 = (
  SELECT COUNT(DISTINCT supply_orders.responsible)
  FROM delivery_note_items
  JOIN supply_orders
    ON supply_orders.id = delivery_note_items.supply_order_id
  WHERE delivery_note_items.delivery_note_id = delivery_notes.id
    AND supply_orders.responsible IN (
      'ا/ نورا السيد',
      'ا/ محمد حسن',
      'الشركة المصرية'
    )
)
AND COALESCE(responsible, '') <> (
  SELECT MIN(supply_orders.responsible)
  FROM delivery_note_items
  JOIN supply_orders
    ON supply_orders.id = delivery_note_items.supply_order_id
  WHERE delivery_note_items.delivery_note_id = delivery_notes.id
    AND supply_orders.responsible IN (
      'ا/ نورا السيد',
      'ا/ محمد حسن',
      'الشركة المصرية'
    )
);

INSERT INTO audit_logs (
  username,
  action,
  table_name,
  record_id,
  before_data,
  after_data,
  created_at
)
SELECT
  'system',
  'SYNC_RESPONSIBLE_FROM_DELIVERY_NOTE',
  'invoices',
  invoices.id,
  json_object('responsible', invoices.responsible),
  json_object(
    'responsible', delivery_notes.responsible,
    'source', 'linked_delivery_note'
  ),
  datetime('now')
FROM invoices
JOIN delivery_notes ON delivery_notes.id = invoices.delivery_note_id
WHERE delivery_notes.responsible IN (
    'ا/ نورا السيد',
    'ا/ محمد حسن',
    'الشركة المصرية'
  )
  AND COALESCE(invoices.responsible, '') <> delivery_notes.responsible;

UPDATE invoices
SET responsible = (
  SELECT delivery_notes.responsible
  FROM delivery_notes
  WHERE delivery_notes.id = invoices.delivery_note_id
)
WHERE delivery_note_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM delivery_notes
    WHERE delivery_notes.id = invoices.delivery_note_id
      AND delivery_notes.responsible IN (
        'ا/ نورا السيد',
        'ا/ محمد حسن',
        'الشركة المصرية'
      )
      AND COALESCE(invoices.responsible, '') <> delivery_notes.responsible
  );

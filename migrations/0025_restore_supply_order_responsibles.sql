-- Restore the historical salesperson for legacy supply orders from each
-- customer's unambiguous collection history. These values were stored on
-- collections before supply_orders gained its own responsible column.
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
  'RESTORE_RESPONSIBLE',
  'supply_orders',
  supply_orders.id,
  json_object('responsible', supply_orders.responsible),
  json_object(
    'responsible', MIN(collections.responsible),
    'source', 'unambiguous_customer_collection_history'
  ),
  datetime('now')
FROM supply_orders
JOIN collections ON collections.customer_id = supply_orders.customer_id
WHERE supply_orders.responsible IS NULL
  AND collections.responsible IN (
    'ا/ نورا السيد',
    'ا/ محمد حسن',
    'الشركة المصرية'
  )
GROUP BY supply_orders.id
HAVING COUNT(DISTINCT collections.responsible) = 1;

UPDATE supply_orders
SET responsible = (
  SELECT MIN(collections.responsible)
  FROM collections
  WHERE collections.customer_id = supply_orders.customer_id
    AND collections.responsible IN (
      'ا/ نورا السيد',
      'ا/ محمد حسن',
      'الشركة المصرية'
    )
)
WHERE responsible IS NULL
  AND 1 = (
    SELECT COUNT(DISTINCT collections.responsible)
    FROM collections
    WHERE collections.customer_id = supply_orders.customer_id
      AND collections.responsible IN (
        'ا/ نورا السيد',
        'ا/ محمد حسن',
        'الشركة المصرية'
      )
  );

-- Mory Sushi has two collection responsibles, but the original workbook and
-- the collection on the order date both identify Mohamed Hassan.
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
  'RESTORE_RESPONSIBLE',
  'supply_orders',
  id,
  json_object('responsible', responsible),
  json_object(
    'responsible', 'ا/ محمد حسن',
    'source', 'original_workbook_and_order_date_collection'
  ),
  datetime('now')
FROM supply_orders
WHERE id = 70
  AND responsible IS NULL;

UPDATE supply_orders
SET responsible = 'ا/ محمد حسن'
WHERE id = 70
  AND responsible IS NULL;

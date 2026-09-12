ALTER TABLE customers ADD COLUMN responsible TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_responsible ON customers(responsible);

WITH responsible_records AS (
  SELECT customer_id, responsible
  FROM supply_orders
  WHERE customer_id IS NOT NULL
    AND responsible IN ('ا/ نورا السيد', 'ا/ محمد حسن', 'الشركة المصرية')
  UNION ALL
  SELECT customer_id, responsible
  FROM delivery_notes
  WHERE customer_id IS NOT NULL
    AND responsible IN ('ا/ نورا السيد', 'ا/ محمد حسن', 'الشركة المصرية')
), assignments AS (
  SELECT customer_id, MIN(responsible) AS responsible
  FROM responsible_records
  GROUP BY customer_id
  HAVING COUNT(DISTINCT responsible) = 1
)
UPDATE customers
SET responsible = (SELECT assignments.responsible FROM assignments WHERE assignments.customer_id=customers.id),
    updated_at = CURRENT_TIMESTAMP
WHERE active=1
  AND name <> 'الوديان'
  AND id IN (SELECT customer_id FROM assignments);

CREATE TABLE _customer_merge_0022 (
  source_id INTEGER PRIMARY KEY,
  target_id INTEGER NOT NULL,
  canonical_name TEXT NOT NULL
);

INSERT INTO _customer_merge_0022(source_id, target_id, canonical_name)
SELECT source.id, target.id, 'كشري الطيب'
FROM customers source
JOIN customers target ON target.normalized_name = 'كشري الطيب'
WHERE source.normalized_name = 'الطيب';

UPDATE customer_opening_balances
SET
  opening_balance = opening_balance + COALESCE((
    SELECT source_balance.opening_balance
    FROM customer_opening_balances source_balance
    JOIN _customer_merge_0022 merge_map ON merge_map.source_id = source_balance.customer_id
    WHERE merge_map.target_id = customer_opening_balances.customer_id
  ), 0),
  updated_at = CURRENT_TIMESTAMP
WHERE customer_id IN (SELECT target_id FROM _customer_merge_0022);

DELETE FROM customer_opening_balances
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0022);

UPDATE collections
SET
  customer_id = (SELECT target_id FROM _customer_merge_0022 WHERE source_id = collections.customer_id),
  client_name = 'كشري الطيب'
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0022);

UPDATE supply_orders
SET
  customer_id = (SELECT target_id FROM _customer_merge_0022 WHERE source_id = supply_orders.customer_id),
  customer_name = 'كشري الطيب'
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0022);

UPDATE delivery_notes
SET
  customer_id = (SELECT target_id FROM _customer_merge_0022 WHERE source_id = delivery_notes.customer_id),
  customer_name = 'كشري الطيب'
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0022);

UPDATE invoices
SET
  customer_id = (SELECT target_id FROM _customer_merge_0022 WHERE source_id = invoices.customer_id),
  customer_name = 'كشري الطيب'
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0022);

INSERT INTO audit_logs(username, action, table_name, record_id, before_data, after_data, created_at)
SELECT
  'codex-production-maintenance',
  'MERGE',
  'customers',
  target_id,
  json_object('source_id', source_id, 'source_name', 'الطيب'),
  json_object('target_id', target_id, 'target_name', canonical_name, 'untouched_customer', 'عنتر الطيب'),
  CURRENT_TIMESTAMP
FROM _customer_merge_0022;

DELETE FROM customers
WHERE id IN (SELECT source_id FROM _customer_merge_0022);

UPDATE customers
SET name = 'كشري الطيب', normalized_name = 'كشري الطيب', updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT target_id FROM _customer_merge_0022);

DROP TABLE _customer_merge_0022;

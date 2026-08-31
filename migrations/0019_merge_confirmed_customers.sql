CREATE TABLE _customer_merge_0019 (
  source_id INTEGER PRIMARY KEY,
  target_id INTEGER NOT NULL,
  canonical_name TEXT NOT NULL
);

INSERT INTO _customer_merge_0019(source_id, target_id, canonical_name)
SELECT source.id, target.id, 'عمرو محروس'
FROM customers source
JOIN customers target ON target.normalized_name = 'عمرو محروس'
WHERE source.normalized_name = 'عمر محروس';

INSERT INTO _customer_merge_0019(source_id, target_id, canonical_name)
SELECT source.id, target.id, 'محمد خيري اسكندرية'
FROM customers source
JOIN customers target ON target.normalized_name = 'محمد خيري اسكندرية'
WHERE source.normalized_name = 'محمد خيري';

UPDATE collections
SET
  customer_id = (SELECT target_id FROM _customer_merge_0019 WHERE source_id = collections.customer_id),
  client_name = (SELECT canonical_name FROM _customer_merge_0019 WHERE source_id = collections.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0019);

UPDATE supply_orders
SET
  customer_id = (SELECT target_id FROM _customer_merge_0019 WHERE source_id = supply_orders.customer_id),
  customer_name = (SELECT canonical_name FROM _customer_merge_0019 WHERE source_id = supply_orders.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0019);

UPDATE delivery_notes
SET
  customer_id = (SELECT target_id FROM _customer_merge_0019 WHERE source_id = delivery_notes.customer_id),
  customer_name = (SELECT canonical_name FROM _customer_merge_0019 WHERE source_id = delivery_notes.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0019);

UPDATE invoices
SET
  customer_id = (SELECT target_id FROM _customer_merge_0019 WHERE source_id = invoices.customer_id),
  customer_name = (SELECT canonical_name FROM _customer_merge_0019 WHERE source_id = invoices.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0019);

DELETE FROM customers
WHERE id IN (SELECT source_id FROM _customer_merge_0019);

DROP TABLE _customer_merge_0019;

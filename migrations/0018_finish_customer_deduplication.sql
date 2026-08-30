CREATE TABLE _customer_merge_0018 (
  source_id INTEGER PRIMARY KEY,
  target_id INTEGER NOT NULL,
  canonical_name TEXT NOT NULL
);

CREATE TABLE _customer_merge_rules_0018 (
  source_key TEXT PRIMARY KEY,
  target_key TEXT NOT NULL,
  canonical_name TEXT NOT NULL
);

INSERT INTO _customer_merge_rules_0018(source_key, target_key, canonical_name) VALUES
  ('الخديوي', 'كشري الخديوي', 'كشرى الخديوى'),
  ('الخيديوي العاشر', 'كشري الخديوي', 'كشرى الخديوى'),
  ('تشيكن فيلدج', 'تشيكن فليدج', 'تشيكن فليدج'),
  ('سمير الصعيدي15000', 'سمير الصعيدي', 'سمير الصعيدى'),
  ('عبد العزيز', 'عبدالعزيز فرز', 'عبدالعزيز فرز'),
  ('عبد العزيز فرز', 'عبدالعزيز فرز', 'عبدالعزيز فرز'),
  ('مينا سلطا الرفاعي', 'مينا', 'مينا'),
  ('موري', 'موري سوشي', 'مورى سوشى'),
  ('يحي الاسكندرية', 'يحي الاسكندريه', 'يحى الإسكندرية');

INSERT INTO _customer_merge_0018(source_id, target_id, canonical_name)
SELECT source.id, target.id, mapping.canonical_name
FROM _customer_merge_rules_0018 mapping
JOIN customers source ON source.normalized_name = mapping.source_key
JOIN customers target ON target.normalized_name = mapping.target_key;

UPDATE collections
SET
  customer_id = (SELECT target_id FROM _customer_merge_0018 WHERE source_id = collections.customer_id),
  client_name = (SELECT canonical_name FROM _customer_merge_0018 WHERE source_id = collections.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0018);

UPDATE supply_orders
SET
  customer_id = (SELECT target_id FROM _customer_merge_0018 WHERE source_id = supply_orders.customer_id),
  customer_name = (SELECT canonical_name FROM _customer_merge_0018 WHERE source_id = supply_orders.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0018);

UPDATE delivery_notes
SET
  customer_id = (SELECT target_id FROM _customer_merge_0018 WHERE source_id = delivery_notes.customer_id),
  customer_name = (SELECT canonical_name FROM _customer_merge_0018 WHERE source_id = delivery_notes.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0018);

UPDATE invoices
SET
  customer_id = (SELECT target_id FROM _customer_merge_0018 WHERE source_id = invoices.customer_id),
  customer_name = (SELECT canonical_name FROM _customer_merge_0018 WHERE source_id = invoices.customer_id)
WHERE customer_id IN (SELECT source_id FROM _customer_merge_0018);

DELETE FROM customers
WHERE id IN (SELECT source_id FROM _customer_merge_0018);

DROP TABLE _customer_merge_0018;
DROP TABLE _customer_merge_rules_0018;

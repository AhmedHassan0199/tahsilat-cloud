CREATE TABLE _customer_merge_0017(source_name TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, canonical_key TEXT NOT NULL);

INSERT INTO _customer_merge_0017 VALUES
('ارابياتا','اربياتا','اربياتا'),
('اربياتا','اربياتا','اربياتا'),
('افندينا السدات','افندينا السادات','افندينا السادات'),
('افندينا السادات','افندينا السادات','افندينا السادات'),
('الخديوى','كشرى الخديوى','كشري الخديوي'),
('الخيديوى العاشر','كشرى الخديوى','كشري الخديوي'),
('كشرى الخديوى','كشرى الخديوى','كشري الخديوي'),
('انسجام','الانسجام','الانسجام'),
('الانسجام','الانسجام','الانسجام'),
('تشيكن فليدج','تشيكن فليدج','تشيكن فليدج'),
('جست سماش','جاست سماش','جاست سماش'),
('جاست سماش','جاست سماش','جاست سماش'),
('دشت','دشت حازم','دشت حازم'),
('دشت حازم','دشت حازم','دشت حازم'),
('راشد','راشد الفيومى','راشد الفيومي'),
('راشد الفيومى','راشد الفيومى','راشد الفيومي'),
('سمير الصعيدى ١٥٠٠٠','سمير الصعيدى','سمير الصعيدي'),
('سمير الصعيدى','سمير الصعيدى','سمير الصعيدي'),
('شيخ يوسف','الشيخ يوسف','الشيخ يوسف'),
('الشيخ يوسف','الشيخ يوسف','الشيخ يوسف'),
('عبدالعزيز','عبدالعزيز فرز','عبدالعزيز فرز'),
('عبدالعزيز فرز','عبدالعزيز فرز','عبدالعزيز فرز'),
('عبد الله طوخ','عبدالله طوخ','عبدالله طوخ'),
('عبدالله طوخ','عبدالله طوخ','عبدالله طوخ'),
('عمرو حكاية','عمرو احمد حكاية','عمرو احمد حكايه'),
('حكايه','عمرو احمد حكاية','عمرو احمد حكايه'),
('عمرو احمد حكاية','عمرو احمد حكاية','عمرو احمد حكايه'),
('كرلوس الخيال','كرولوس الخيال','كرولوس الخيال'),
('كرولس الخيال','كرولوس الخيال','كرولوس الخيال'),
('كرولوس الخيال','كرولوس الخيال','كرولوس الخيال'),
('محمود عامر','72 كار هب','72 كار هب'),
('72 كار هب','72 كار هب','72 كار هب'),
('اكله','مطعم اكلة','مطعم اكله'),
('اكلة','مطعم اكلة','مطعم اكله'),
('مطعم اكلة','مطعم اكلة','مطعم اكله'),
('ملوك القرمشه','بسام يحيى ملوك القرمشة','بسام يحيي ملوك القرمشه'),
('بسام يحيى ملوك القرمشة','بسام يحيى ملوك القرمشة','بسام يحيي ملوك القرمشه'),
('مينا سلطا الرفاعى','مينا','مينا'),
('مينا','مينا','مينا'),
('مورى','مورى سوشى','موري سوشي'),
('مورى سوشى','مورى سوشى','موري سوشي'),
('يحيئ','يحى الإسكندرية','يحي الاسكندريه'),
('يحى الإسكندرية','يحى الإسكندرية','يحي الاسكندريه'),
('وينجز','تشيكن ويز قطر','تشيكن ويز قطر'),
('شيكن وينجز','تشيكن ويز قطر','تشيكن ويز قطر'),
('تشيكن ويز قطر','تشيكن ويز قطر','تشيكن ويز قطر');

INSERT OR IGNORE INTO customers(name, normalized_name, active, created_at, updated_at)
SELECT canonical_name, canonical_key, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM _customer_merge_0017 GROUP BY canonical_name, canonical_key;

UPDATE customers SET active=1, is_transient=0, updated_at=CURRENT_TIMESTAMP,
  name=(SELECT canonical_name FROM _customer_merge_0017 WHERE canonical_key=customers.normalized_name LIMIT 1)
WHERE normalized_name IN (SELECT canonical_key FROM _customer_merge_0017);

UPDATE collections SET
  customer_id=(SELECT c.id FROM customers c JOIN _customer_merge_0017 m ON c.normalized_name=m.canonical_key WHERE TRIM(collections.client_name)=m.source_name LIMIT 1),
  client_name=(SELECT m.canonical_name FROM _customer_merge_0017 m WHERE TRIM(collections.client_name)=m.source_name LIMIT 1)
WHERE TRIM(client_name) IN (SELECT source_name FROM _customer_merge_0017);

UPDATE supply_orders SET
  customer_id=(SELECT c.id FROM customers c JOIN _customer_merge_0017 m ON c.normalized_name=m.canonical_key WHERE TRIM(supply_orders.customer_name)=m.source_name LIMIT 1),
  customer_name=(SELECT m.canonical_name FROM _customer_merge_0017 m WHERE TRIM(supply_orders.customer_name)=m.source_name LIMIT 1)
WHERE TRIM(customer_name) IN (SELECT source_name FROM _customer_merge_0017);

UPDATE delivery_notes SET
  customer_id=(SELECT c.id FROM customers c JOIN _customer_merge_0017 m ON c.normalized_name=m.canonical_key WHERE TRIM(delivery_notes.customer_name)=m.source_name LIMIT 1),
  customer_name=(SELECT m.canonical_name FROM _customer_merge_0017 m WHERE TRIM(delivery_notes.customer_name)=m.source_name LIMIT 1)
WHERE TRIM(customer_name) IN (SELECT source_name FROM _customer_merge_0017);

UPDATE invoices SET
  customer_id=(SELECT c.id FROM customers c JOIN _customer_merge_0017 m ON c.normalized_name=m.canonical_key WHERE TRIM(invoices.customer_name)=m.source_name LIMIT 1),
  customer_name=(SELECT m.canonical_name FROM _customer_merge_0017 m WHERE TRIM(invoices.customer_name)=m.source_name LIMIT 1)
WHERE TRIM(customer_name) IN (SELECT source_name FROM _customer_merge_0017);

DELETE FROM customers
WHERE TRIM(name) IN (SELECT source_name FROM _customer_merge_0017)
  AND normalized_name NOT IN (SELECT canonical_key FROM _customer_merge_0017);

DROP TABLE _customer_merge_0017;

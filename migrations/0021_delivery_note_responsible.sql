ALTER TABLE delivery_notes ADD COLUMN responsible TEXT;

UPDATE collections
SET responsible = 'ا/ نورا السيد'
WHERE TRIM(responsible) = 'نورا';

UPDATE collections
SET responsible = 'ا/ محمد حسن'
WHERE TRIM(responsible) = 'محمد حسن';

UPDATE collections
SET responsible = 'الشركة المصرية'
WHERE TRIM(responsible) = 'المصريه';

UPDATE delivery_notes
SET responsible = (
  SELECT NULLIF(TRIM(users.display_name), '')
  FROM users
  WHERE users.id = delivery_notes.created_by
)
WHERE responsible IS NULL;

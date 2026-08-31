UPDATE supply_orders
SET responsible = NULL
WHERE responsible IS NOT NULL
  AND responsible NOT IN ('ا/ نورا السيد', 'ا/ محمد حسن', 'الشركة المصرية');

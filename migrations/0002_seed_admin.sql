INSERT OR IGNORE INTO users(username, display_name, password_hash, role, active, created_at)
VALUES (
  'admin',
  'مدير النظام',
  'pbkdf2$120000$G9AJApmuGAQGivkHhd+6Fw==$jB3Wk/d9po9S6XQJgkvg0U70wgMoTiKBev7z0CBBUOY=',
  'admin',
  1,
  '2026-06-30T00:00:00.000Z'
);

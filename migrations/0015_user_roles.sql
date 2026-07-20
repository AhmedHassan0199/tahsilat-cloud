-- Replace the legacy broad-write `user` role with the restricted collector role.
UPDATE users
SET role = 'collector'
WHERE role = 'user';

# Tahsilat Cloud

Cloudflare Workers + D1 version of the Tahsilat system.

## What This Version Uses

- Cloudflare Worker for the backend API.
- Cloudflare D1 for the database.
- Cloudflare Worker assets for the HTML/CSS/JS frontend.
- Login via secure HTTP-only session cookie.
- PBKDF2 password hashing.
- Audit logs for login/logout and every insert/update/delete.

## Default Admin

Initial login after deployment:

```text
username: admin
password: ChangeMe123!
```

Create a new admin/password after first login, then replace or remove this seeded account in a later migration.

## Local Files

```text
public/                 Frontend
src/worker.js           Cloudflare Worker API
migrations/             D1 schema and admin seed
exports/current_data.sql Current imported Tahsilat data
wrangler.toml           Cloudflare config
```

## Deployment Summary

1. Install Node.js locally if needed.
2. In this folder, run `npm install`.
3. Login to Cloudflare with `npx wrangler login`.
4. Create D1 with `npx wrangler d1 create tahsilat-db`.
5. Copy the returned `database_id` into `wrangler.toml`.
6. Apply migrations:

```bash
npx wrangler d1 migrations apply tahsilat-db --remote
```

7. Import current data:

```bash
npx wrangler d1 execute tahsilat-db --remote --file ./exports/current_data.sql
```

8. Deploy:

```bash
npx wrangler deploy
```

## Notes

- This cloud version does not use Excel as the database.
- Excel export/import can be added later as a cloud feature.
- For 5 users, Cloudflare Workers + D1 should remain within the free limits comfortably.

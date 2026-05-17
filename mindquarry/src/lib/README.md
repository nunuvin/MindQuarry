# Lib Folder

`src/lib/` contains shared application services and integration code.

## What Is Here Today

- `auth.ts`: Better Auth server configuration.
- `auth-client.ts`: Better Auth client instance for React usage.
- `authHelpers.ts`: narrow auth/session helpers for server code.
- `db.ts`: Kysely database connection and auth table typings.
- `utils.ts`: general utility helpers.

## Conventions

- Keep external service setup and shared helpers here.
- Keep database typing aligned with the SQL schema in `postgres/`.
- Avoid moving route-specific presentation logic into this folder.
# Postgres Folder

`postgres/` contains SQL used to bootstrap the local PostgreSQL side of MindQuarry.

## What Is Here Today

- `extensions.sql`: extension setup.
- `mqauth_init.sql`: Better Auth tables in the `mqauth` schema.
- `auth_table_create.sql`: additional table creation script.
- `setup_mqauth_user_and_schema.sql`: reserved setup file, currently empty.

## Current Database Direction

The implemented schema currently focuses on Better Auth tables:

- `user`
- `session`
- `account`
- `verification`

These should stay aligned with the typed schema in `mindquarry/src/lib/db.ts`.

When core Q&A tables are added later, document them here and keep the application typing in sync.
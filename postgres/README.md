# Postgres Folder

`postgres/` contains SQL used to bootstrap the local PostgreSQL side of MindQuarry.

## How to setup for the first time

To set up your Postgres database for MindQuarry, execute these files against your database in the following order:

1. `extensions.sql` - Enables necessary extensions (pgcrypto, unaccent, pg_trgm, pg_cron).
2. `mqauth_init.sql` - Bootstraps the Better Auth core tables in the secure `mq_auth` schema.
3. `core_schema.sql` - Bootstraps all the extended MindQuarry Q&A, Moderation, and Messaging tables into the `mq_public` schema.

Example using `psql`:

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/extensions.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/mqauth_init.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/core_schema.sql
```

## Existing Installations

The `core_schema.sql` script uses `IF NOT EXISTS` for all tables, making it safe to run against an existing database that already has the `mqauth_init.sql` schema applied.

Ensure your `DATABASE_URL` in `.env` is set correctly:

```
DATABASE_URL="postgres://mqauth_user:your_strong_password_here@localhost:5432/mindquarry_db"
```

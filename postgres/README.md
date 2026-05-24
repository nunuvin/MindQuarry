# Postgres Folder

`postgres/` contains SQL used to bootstrap the local PostgreSQL side of MindQuarry.

## How to setup for the first time

To set up your Postgres database for MindQuarry, execute these files against your database in the following order:

1. `extensions.sql` - Enables necessary extensions (pgcrypto, unaccent, pg_trgm).
2. `mqauth_init.sql` - Bootstraps the Better Auth core tables in the secure `mqauth` schema.
3. `core_schema.sql` - Bootstraps all the extended MindQuarry Q&A, Moderation, and Messaging tables into the `mq_public` schema.

Example using `psql`:

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/extensions.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/mqauth_init.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/core_schema.sql
```

## Session Maintenance

Expired Better Auth sessions are no longer cleaned up with `pg_cron`. Run the Node-based maintenance command from `mindquarry/` on a schedule instead:

```bash
npm run sessions:cleanup
```

For a long-running Node process, use:

```bash
npm run sessions:watch
```

You can override the poll interval for the watch mode with `SESSION_CLEANUP_INTERVAL_MS`.

MindQuarry intentionally avoids Windows-incompatible scheduling extensions such as `pg_cron`, and does not require the `vector` extension for local setup.

## Existing Installations

The `core_schema.sql` script uses `IF NOT EXISTS` for all tables, making it safe to run against an existing database that already has the `mqauth_init.sql` schema applied.

Ensure your `DATABASE_URL` in `.env` is set correctly:

```
DATABASE_URL="postgres://mqauth_user:your_strong_password_here@localhost:5432/mindquarry_db"
```

# Postgres Folder

`postgres/` contains SQL used to bootstrap the local PostgreSQL side of MindQuarry.

## How to setup for the first time

To set up your Postgres database for MindQuarry, execute these files against your database in the following order:

1. `extensions.sql` - Enables necessary extensions (pgcrypto, unaccent, pg_trgm).
2. `mqauth_init.sql` - Bootstraps the Better Auth core tables in the secure `mqauth` schema.
3. `core_schema.sql` - Bootstraps all the extended MindQuarry Q&A, Moderation, Messaging, posting-policy, validation, and archive tables into the `mq_public` schema.
4. `indexes.sql` - Adds the non-primary indexes used by search, moderation queue lookups, and messaging reads.

Example using `psql`:

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/extensions.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/mqauth_init.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/core_schema.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/indexes.sql
```

`mqauth_init.sql` now seeds a sentinel deleted-user account with id `-1`. The app uses that record when users delete their accounts so historical queries, answers, messages, and moderation references remain attached to a non-login system identity.

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

For existing databases, run the additive upgrade script instead of replaying scratch files:

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/psql_update.sql
```

`psql_update.sql` now attempts to create the required `pgcrypto`, `unaccent`, and `pg_trgm` extensions before applying schema and index changes. If your application database role cannot run `CREATE EXTENSION`, apply `postgres/extensions.sql` first with a superuser or another role that has extension privileges, then rerun `psql_update.sql`.

That update path adds:

- the deleted-user sentinel seed
- quarry `content_review_mode`
- query and answer validation metadata
- archived-thread columns
- hidden-message metadata
- the `posting_policies` table and moderation indexes

Ensure your `DATABASE_URL` in `.env` is set correctly:

```
DATABASE_URL="postgres://mqauth_user:your_strong_password_here@localhost:5432/mindquarry_db"
```

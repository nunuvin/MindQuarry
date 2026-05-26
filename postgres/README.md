# Postgres Folder

`postgres/` contains the SQL needed to bootstrap and evolve MindQuarry’s database.

MindQuarry uses two logical areas:

- `mqauth`: Better Auth tables
- `mq_public`: application tables for queries, answers, messaging, moderation, notifications, follows, and search support

## What Each File Does

- `extensions.sql`: enables required extensions such as `pgcrypto`, `unaccent`, and `pg_trgm`
- `mqauth_init.sql`: creates the Better Auth schema and seeds the deleted-user sentinel
- `core_schema.sql`: creates the MindQuarry application tables
- `indexes.sql`: adds non-primary indexes, including search-related indexes
- `psql_update.sql`: additive upgrade path for existing databases

## First-Time Setup

Run these files in order against a new database:

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/extensions.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/mqauth_init.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/core_schema.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/indexes.sql
```

`mqauth_init.sql` seeds a sentinel deleted-user record with id `-1`. When users delete their accounts, authored content is reassigned to that record instead of being orphaned or hard-deleted.

## Upgrading An Existing Database

Use the additive upgrade script for an existing installation:

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/psql_update.sql
```

The upgrade path now covers:

- deleted-user support
- quarry `content_review_mode`
- query and answer validation fields
- archived-thread fields
- hidden-message metadata
- posting policies and moderation indexes
- newer search/index updates

`psql_update.sql` attempts to create `pgcrypto`, `unaccent`, and `pg_trgm` if they are missing. If the app role cannot create extensions, run `extensions.sql` first with a role that has extension privileges and then rerun `psql_update.sql`.

The trigram-index update path is also careful about extension schema placement. Some PostgreSQL installs expose `gin_trgm_ops` outside the app search path, so the upgrade and index scripts now resolve the extension schema dynamically instead of assuming the operator class is globally visible.

## Session Maintenance

MindQuarry intentionally avoids Windows-hostile scheduler extensions such as `pg_cron`.

Instead, clean up expired Better Auth sessions from the app folder with:

```bash
cd mindquarry
npm run sessions:cleanup
```

For a long-running watcher:

```bash
npm run sessions:watch
```

You can override the watch interval with `SESSION_CLEANUP_INTERVAL_MS`.

## Connection Notes

The app-side PostgreSQL connection sets `search_path=mq_public,mqauth` so auth and product tables resolve consistently.

Example:

```env
DATABASE_URL="postgres://mqauth_user:your_strong_password_here@localhost:5432/mindquarry_db"
```

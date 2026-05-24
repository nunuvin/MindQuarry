# MindQuarry Workspace

MindQuarry is a Stack Overflow-like Q&A application with community spaces, threaded discussions, moderation surfaces, and account-aware social features. This repository contains the Next.js app and the PostgreSQL bootstrap scripts used to run it locally.

## Workspace Layout

- `mindquarry/`: the web application.
- `postgres/`: SQL files for local PostgreSQL setup and auth schema bootstrap.
- `TODO.md`: scratch planning notes.

## Chosen Stack

The application stack is defined by `mindquarry/package.json`:

- Next.js 15 App Router
- React 19
- TypeScript 5
- Better Auth for authentication
- Kysely and `pg` for PostgreSQL access
- Tailwind CSS v4
- shadcn/ui conventions with Radix primitives and Lucide icons

## Current Status

Implemented:

- Better Auth with username and admin plugins, plus login and signup flows.
- Feed, discovery sorting, community index, community detail, and query discussion routes.
- Rich-text query and answer authoring with sanitized rendering.
- Rich search across users, quarries, and threads, including `u:`, `q:`, and `query:` prefixes, paginated fetches, and answer-body matching.
- Query and answer voting, per-thread subscriptions, and profile metric refresh on vote changes.
- User follows, notification fan-out, mention notifications, unread notification counts, and a notifications page.
- Public and restricted visibility rules for profiles and communities.
- Direct messaging flows, including inbox, conversation pages, read tracking, streaming updates, and self-service message deletion.
- Question editing plus answer editing and deletion using the same rich-text editor surfaces as initial creation.
- Account deletion that preserves authored content by reassigning it to the sentinel deleted-user record in `mqauth.user`.
- Community moderation roles for `admin` and `moderator`, including moderation queues, history views, pending-review approval, hidden-content recovery, and user-specific posting restrictions.
- Community and instance posting policies that can force query-only or query-and-answer review, or silence posting per user.
- Thread archival plus query deletion rules: authors can remove unanswered threads, while quarry admins can archive threads or delete threads that already have responses.
- Admin and moderation entry points such as reports, user management surfaces, community queues, and admin-controlled direct-message hiding.
- Shared shell behaviors including the notification bell, collapsible sidebar, dismissible home promo rail, cookie notice, and user menu.
- App-level TOML configuration in `mindquarry/mq_config.toml` for adjustable limits, search page sizes, rate limits, and notices.
- Query view counting limited to one increment per viewer per configured time window.

Still missing or partial:

- Password reset and broader account recovery flows are not implemented yet.
- Search and tagging now cover the main product path, but relevance tuning, richer ranking, and more exhaustive legacy-schema upgrade coverage still need work.
- Several pages and flows still need deeper automated coverage despite the improved Jest and Playwright suites.
- Moderation, admin tooling, and messaging are usable, but policy UX, audit depth, and broader regression coverage still need work.
- Background work remains Node-script driven rather than a fuller production job orchestration setup.

## Testing And Verification

The app currently has:

- Granular Jest unit and route-handler coverage.
- Playwright browser smoke coverage for auth, home-shell interactions, and the communities index.
- A full verification script that runs build, Jest in-band, and Playwright.

Common commands:

```bash
cd mindquarry
npm test -- --runInBand
npm run test:coverage
npm run test:e2e
npm run verify
```

## Local Setup

### New Installation

1. Install dependencies in the Next app:
   ```bash
   cd mindquarry
   npm install
   ```

2. Setup the database. See `postgres/README.md` for execution order.
   ```bash
   psql -U postgres -d your_db -f postgres/extensions.sql
   psql -U postgres -d your_db -f postgres/mqauth_init.sql
   psql -U postgres -d your_db -f postgres/core_schema.sql
   ```

3. Configure your `.env` file inside `mindquarry/` with your `DATABASE_URL`.
   The app sets `search_path` to `mq_public,mqauth` in code, so auth and app tables resolve consistently.
   Existing installations should also apply `postgres/psql_update.sql` to pick up moderation-policy, archive, validation, and deleted-user schema changes.

4. Review `mindquarry/mq_config.toml` if you want to adjust feed limits, search page sizes, mutation/search rate limits, notification polling, cookie notice text, or the unique query-view window.

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Run tests or the full verification pass before or after larger changes:
   ```bash
   npm run test:coverage
   npm run test:e2e
   npm run verify
   ```

### Existing Installation Updates

If you already have a running instance and we add new packages or schema changes, do the following:

1. Update packages:
   ```bash
   cd mindquarry
   npm install
   ```

2. Safely apply schema updates (uses `IF NOT EXISTS`):
   ```bash
   psql -U postgres -d your_db -f postgres/psql_update.sql
   ```

3. The update path now seeds a sentinel deleted-user account with id `-1` and adds moderation-policy, validation, archive, and hide-state columns used by the app runtime.

4. If you want legacy environments to pick up the latest visibility and search columns instead of relying on app-side fallbacks, rerun the non-auth scratch-safe scripts as needed:
   ```bash
   psql -U postgres -d your_db -f postgres/extensions.sql
   psql -U postgres -d your_db -f postgres/indexes.sql
   ```

## Where To Work

- See `mindquarry/README.md` for app-specific setup.
- See `postgres/README.md` for the SQL folder purpose.
- See the README files under `mindquarry/src/` for folder-level guidance.

## Copilot Customization

Project instructions live in `.github/`:

- `.github/copilot-instructions.md`: repo-wide engineering guidance.
- `.github/instructions/*.instructions.md`: folder-scoped instructions for app, components, lib, and SQL work.

## VS Code Tasks

Workspace tasks live in `.vscode/tasks.json` and wrap the current app scripts:

- Build
- Jest
- Jest Coverage
- Playwright
- Verify
- Verify then Dev
- Session cleanup one-shot and watch tasks
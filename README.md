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
- Query and answer voting, per-thread subscriptions, and profile metric refresh on vote changes.
- User follows, notification fan-out, mention notifications, unread notification counts, and a notifications page.
- Public and restricted visibility rules for profiles and communities.
- Direct messaging flows, including inbox, conversation pages, read tracking, and streaming updates.
- Moderation and admin entry points such as reports, user management surfaces, and community queues.
- Shared shell behaviors including the notification bell, collapsible sidebar, dismissible home promo rail, cookie notice, and user menu.
- App-level TOML configuration in `mindquarry/mq_config.toml` for adjustable limits and notices.
- Query view counting limited to one increment per viewer per configured time window.

Still missing or partial:

- Password reset and broader account recovery flows are not implemented yet.
- Search, tagging, and reputation exist only in lightweight or incomplete form.
- Several pages and flows still need deeper automated coverage despite the improved Jest and Playwright suites.
- Moderation, admin tooling, and messaging are usable but not yet complete product-grade workflows.
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

4. Review `mindquarry/mq_config.toml` if you want to adjust feed limits, notification polling, cookie notice text, or the unique query-view window.

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
   psql -U postgres -d your_db -f postgres/core_schema.sql
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
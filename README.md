# MindQuarry Workspace

MindQuarry is a community-first Q&A product. It combines Stack Overflow-style knowledge exchange with named communities called quarries, richer moderation controls, profile visibility, direct messaging, follows, notifications, and instance-wide administration.

This repository contains two main pieces:

- `mindquarry/`: the Next.js application.
- `postgres/`: PostgreSQL bootstrap and upgrade scripts for the auth and app schemas.

## What MindQuarry Does

MindQuarry is built around topical communities and discussion threads:

- Users browse and join quarries, then submit queries and answers with rich-text formatting.
- Threads support voting, accepted answers, follows, mentions, notifications, and view tracking.
- Profiles and communities support visibility controls, so some content is public, some is authenticated-only, and some is membership-scoped.
- Messaging supports inbox, group conversations, read state, streaming updates, soft-deleted message tombstones, and admin moderation.
- Quarry admins and moderators can work pending-review queues, hide content, review moderation history, and apply per-user posting restrictions.
- Instance admins can manage users, search across admin-only content, issue temporary passwords that force a password change on next login, and navigate directly into quarry moderation flows.

## Current Feature Set

The product already includes:

- Better Auth login and signup with username-based auth.
- Feed, community index, quarry detail pages, and full query discussion routes.
- Rich-text authoring and sanitized rendering for queries, answers, and chat.
- Search across users, quarries, and queries with `u:`, `q:`, `p:`, and `query:` prefixes.
- Admin-aware search results with access-aware edge styling for public, signed-in, membership-only, and admin-only hits.
- Query and answer voting, accepted answers, and per-thread subscriptions.
- Follows, mentions, notifications, unread counts, and profile metrics.
- Profile visibility and messaging privacy controls.
- Self-service password change in settings, plus admin-issued temporary passwords with forced password rotation on next sign-in.
- Direct messaging, group chats, read receipts, and event-driven refresh behavior.
- Query, answer, chat-message, and whole-conversation reporting, with quarry-to-instance escalation support and stored moderation context.
- Account self-deletion with authored content reassigned to the deleted-user sentinel instead of being orphaned.
- Quarry moderation roles for admins and moderators.
- Quarry and instance posting policies, including forced review and posting restrictions.
- Pending review for new content, hidden-content recovery, archive flows, and role-aware query deletion rules.
- Instance admin surfaces for user management, reports, and global moderation.
- Shared shell behaviors such as the collapsible sidebar, theme toggle, cookie notice, and user menu.

Still partial or intentionally pending:

- Full self-service forgotten-password recovery outside the current authenticated change-password and admin-issued temporary reset flows.
- Deeper moderation analytics and longer-term audit tooling.
- More exhaustive automated coverage across all page states and workflows.
- More advanced search ranking and richer tag/discovery tuning.
- Production-grade background scheduling beyond the current Node-driven maintenance tasks.

## Stack

The application currently uses:

- Next.js 15 App Router
- React 19
- TypeScript 5
- Better Auth
- Kysely with PostgreSQL
- Tailwind CSS v4
- shadcn/ui-style patterns, Radix primitives, and Lucide icons

## Repository Layout

- `mindquarry/`: application code, scripts, tests, Playwright config, and app docs.
- `postgres/`: scratch-safe SQL, upgrade SQL, and auth/app schema bootstrap files.
- `mindquarry/src/app/`: routes, layouts, and route handlers.
- `mindquarry/src/components/`: shared UI and interaction components.
- `mindquarry/src/lib/`: shared auth, database, moderation, search, and helper code.

## Setup

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL 15+ with permission to create the required extensions or a superuser available to do it once

### First-Time Local Setup

1. Install app dependencies.

```bash
cd mindquarry
npm install
```

2. Create a PostgreSQL database and run the scratch bootstrap in order.

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/extensions.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/mqauth_init.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/core_schema.sql
psql -U your_postgres_user -d mindquarry_db -f postgres/indexes.sql
```

3. Create `mindquarry/.env` and point `DATABASE_URL` at that database.

4. Optionally adjust `mindquarry/mq_config.toml` for search limits, rate limits, notification polling, cookie notice text, and view-count timing.

5. Start the app.

```bash
cd mindquarry
npm run dev
```

### Updating An Existing Database

If the database already exists, apply the additive update script instead of replaying the scratch files.

```bash
psql -U your_postgres_user -d mindquarry_db -f postgres/psql_update.sql
```

That upgrade path now covers deleted-user support, moderation and posting-policy schema, validation/archive fields, hidden-message metadata, forced-password-reset flags, chat report context sizing, richer report metadata, and search-related index updates.

## Testing And Verification

MindQuarry uses both Jest and Playwright.

Common commands:

```bash
cd mindquarry
npm test -- --runInBand
npm run test:coverage
npm run test:e2e
npm run verify
```

For the dedicated testing guide, see [mindquarry/docs/testing/README.md](mindquarry/docs/testing/README.md).

## More Documentation

- App overview: [mindquarry/README.md](mindquarry/README.md)
- PostgreSQL setup: [postgres/README.md](postgres/README.md)
- Source folder overview: [mindquarry/src/README.md](mindquarry/src/README.md)
- Route-layer notes: [mindquarry/src/app/README.md](mindquarry/src/app/README.md)
- Shared component notes: [mindquarry/src/components/README.md](mindquarry/src/components/README.md)
- Shared library notes: [mindquarry/src/lib/README.md](mindquarry/src/lib/README.md)

## VS Code Tasks

Workspace tasks in `.vscode/tasks.json` wrap the common developer flows:

- build
- Jest
- Jest coverage
- Playwright
- verify
- verify then dev
- session cleanup one-shot and watch tasks
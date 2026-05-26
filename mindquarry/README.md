# MindQuarry App

`mindquarry/` contains the Next.js application for MindQuarry.

At a product level, this app is a Q&A system with community boundaries, moderation tooling, messaging, and visibility-aware social features. It is not just a feed plus thread UI; the implementation already includes a sizeable amount of lifecycle and policy logic around what can be posted, who can see it, and how admins and moderators intervene.

## Main Product Areas

### Core Q&A

- Quarry index and quarry detail pages
- Query submission, query discussion, answers, replies, and accepted answers
- Voting and view tracking
- Rich-text authoring and sanitized rendering
- Thread follow/subscription flows
- Mention suggestions sourced from followed users and current thread participants, plus `@all` support for notifying thread followers

### Search And Discovery

- Search scopes for users, quarries, and queries
- `u:`, `q:`, `p:`, and `query:` prefixes
- Answer-body matching as well as query-body/title matching
- Access-aware search results, including admin-only discovery of otherwise restricted content

### Identity And Social Features

- Better Auth login and signup
- Profiles, follows, mentions, notifications, and live SSE badge updates
- Profile visibility and messaging privacy controls

### Messaging

- Inbox and group chat flows
- Live chat updates and read tracking
- Soft-deleted message tombstones
- Admin message hiding

### Moderation And Admin

- Quarry admins and moderators with separate capabilities
- Pending-review queues and moderation history
- Per-user posting restrictions
- Query archive/delete rules
- Global admin reports and user management

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test -- --runInBand
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run verify
npm run sessions:cleanup
npm run sessions:watch
```

Useful shortcuts:

- `npm run dev`: start the app with Turbopack
- `npm run verify`: run build, Jest in-band, and Playwright in sequence
- `npm run sessions:cleanup`: remove expired Better Auth sessions

Authenticated Playwright coverage uses `e2e/global.setup.ts` and `e2e/auth.shared.ts`. When the repo root `.env` provides `test_user`, `test_password`, and `test_email`, the setup will provision or sign in that user automatically before browser tests run.

For the dedicated test guide, see [docs/testing/README.md](docs/testing/README.md).

## Environment And Config

The app expects `DATABASE_URL` and reads additional app-level behavior from `mq_config.toml`.

`mq_config.toml` currently controls:

- feed sizing
- search batch sizes
- rate limits
- notification polling
- cookie notice text
- query-view timing windows

Depending on the deployment environment, Better Auth may also require the usual auth-related environment variables.

## Folder Guide

- `src/app/`: App Router pages, layouts, and route handlers
- `src/components/`: shared UI, shell, and editor controls
- `src/lib/`: auth, database, moderation, search, and integration helpers
- `public/`: static assets
- `scripts/`: maintenance and local helper scripts

## Notes

- The repo includes a local `.npmrc` so installs remain consistent.
- Session cleanup is handled with Node scripts rather than PostgreSQL scheduler extensions such as `pg_cron`.
- Search gracefully falls back when optional search functions or newer visibility columns are missing from an older local database.
- Password reset is intentionally not claimed as implemented yet; the settings page only reserves space for that future flow.

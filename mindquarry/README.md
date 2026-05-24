# MindQuarry App

This folder contains the Next.js application for MindQuarry, a Stack Overflow-like Q&A product with community spaces, discussions, messaging, notifications, and moderation flows.

## Stack

The current app stack from `package.json` is:

- Next.js 15 App Router
- React 19
- TypeScript 5
- Better Auth
- Kysely with PostgreSQL
- Tailwind CSS v4
- shadcn/ui-style primitives with Radix and Lucide

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test -- --runInBand
npm run test:coverage
npm run test:e2e
npm run verify
npm run sessions:cleanup
npm run sessions:watch
```

`npm run dev` starts the app with Turbopack.
`npm run test:coverage` runs the Jest suite with coverage collection.
`npm run verify` runs build, Jest in-band, and Playwright in sequence.

## Environment

The code currently reads `DATABASE_URL` in `src/lib/db.ts`.

Depending on how Better Auth is configured for the target environment, standard Better Auth environment variables may also be needed during local development or deployment.

Application-level adjustable limits and notices are also loaded from `mq_config.toml` at the app root. That file currently controls feed limits, search fetch sizes, mutation and search rate limits, notification polling, the unique query view window, and the cookie notice text.

## Current Implementation

Implemented:

- Better Auth server configuration in `src/lib/auth.ts`
- Better Auth client configuration in `src/lib/auth-client.ts`
- Next.js auth handler route in `src/app/api/auth/[...all]/route.ts`
- Login and signup flows in `src/app/login/page.tsx` and `src/app/signup/page.tsx`
- Session helper in `src/lib/authHelpers.ts`
- Feed, discovery sorting, community, and query discussion routes under `src/app/`
- Rich search with explicit `u:`, `q:`, and `query:` scopes, paginated entity fetches, and thread matching against answers as well as question content
- Privacy, follows, subscriptions, mentions, notifications, and profile visibility flows under `src/app/`
- Messaging inbox and conversation flows under `src/app/messages/`, including author-owned message deletion
- Question editing plus answer editing and deletion with the same TipTap authoring controls used during creation
- Account self-deletion in `src/app/settings/page.tsx`, with authored content reassigned to the sentinel deleted-user account instead of being orphaned
- Posting-policy and moderation helpers in `src/lib/moderation.ts` for instance defaults, quarry defaults, and per-user overrides
- Quarry moderation roles that distinguish full quarry admins from moderators who can work queues, approve pending content, hide content, and apply non-ban restrictions
- Pending-review submission flows for queries and answers, plus approved-only public search/feed visibility
- Thread archival and role-aware query deletion behavior on the discussion route
- Admin controls to delete users and apply instance-wide posting-policy rules
- Admin-controlled direct-message hiding in conversation pages
- API routes for notification counts and chat read/stream behavior
- API route for rate-limited search fetches under `src/app/api/search/route.ts`
- Report and moderation queue routes for community moderation
- Protected user profile route in `src/app/users/[username]/page.tsx`
- Shared navigation chrome and rich-text editing controls in `src/components/`
- Dismissible home promo and cookie notice components
- TOML-backed app configuration via `mq_config.toml`
- View throttling so a query view is counted once per viewer per configured time window

Not implemented yet:

- Password reset and recovery flows
- Broader content history/versioning
- Richer moderation analytics and audit trails beyond the current queue/history surfaces
- Exhaustive browser and route coverage for every page and state transition
- Production-grade background job orchestration beyond the current Node-maintained tasks

## Folder Guide

- `src/app/`: routes, layouts, and page-level composition
- `src/components/`: shared UI and navigation
- `src/lib/`: auth, database, and helpers
- `public/`: static assets

See the README files inside `src/` for more folder-specific notes.

## Notes

- The repo includes a local `.npmrc` so app installs still bring in required dev and optional dependencies even if your global npm config omits them.
- Session cleanup is intentionally handled through the Node scripts above instead of PostgreSQL scheduler extensions such as `pg_cron`.
- Query view counts are rate-limited per viewer to one increment per five-minute window.
- Search follows the same config-driven rate limiting and will gracefully fall back when optional search functions or newer visibility columns are missing from an older local database.
- Route-handler tests depend on the web API polyfills configured in `jest.env.ts` and `jest.setup.ts`.
- Public thread lists and search results now exclude pending-review or hidden content; moderators work those items from the quarry queue instead.

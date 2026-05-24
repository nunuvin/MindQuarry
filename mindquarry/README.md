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

Application-level adjustable limits and notices are also loaded from `mq_config.toml` at the app root. That file currently controls feed limits, reply rate limits, notification polling, the unique query view window, and the cookie notice text.

## Current Implementation

Implemented:

- Better Auth server configuration in `src/lib/auth.ts`
- Better Auth client configuration in `src/lib/auth-client.ts`
- Next.js auth handler route in `src/app/api/auth/[...all]/route.ts`
- Login and signup flows in `src/app/login/page.tsx` and `src/app/signup/page.tsx`
- Session helper in `src/lib/authHelpers.ts`
- Feed, discovery sorting, community, and query discussion routes under `src/app/`
- Privacy, follows, subscriptions, mentions, notifications, and profile visibility flows under `src/app/`
- Messaging inbox and conversation flows under `src/app/messages/`
- API routes for notification counts and chat read/stream behavior
- Report and moderation queue routes for community moderation
- Protected user profile route in `src/app/users/[username]/page.tsx`
- Shared navigation chrome and rich-text editing controls in `src/components/`
- Dismissible home promo and cookie notice components
- TOML-backed app configuration via `mq_config.toml`
- View throttling so a query view is counted once per viewer per configured time window

Not implemented yet:

- Password reset and recovery flows
- Mature tagging, reputation, and search behavior
- Complete admin and moderation workflows
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
- Route-handler tests depend on the web API polyfills configured in `jest.env.ts` and `jest.setup.ts`.

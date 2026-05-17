# MindQuarry App

This folder contains the Next.js application for MindQuarry, a Stack Overflow-like product in progress.

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
```

`npm run dev` starts the app with Turbopack.

## Environment

The code currently reads `DATABASE_URL` in `src/lib/db.ts`.

Depending on how Better Auth is configured for the target environment, standard Better Auth environment variables may also be needed during local development or deployment.

## Current Implementation

Implemented:

- Better Auth server configuration in `src/lib/auth.ts`
- Better Auth client configuration in `src/lib/auth-client.ts`
- Next.js auth handler route in `src/app/api/auth/[...all]/route.ts`
- Login page in `src/app/login/page.tsx`
- Signup page in `src/app/signup/page.tsx`
- Session helper in `src/lib/authHelpers.ts`
- Protected user profile route in `src/app/users/[username]/page.tsx`
- Shared navigation chrome in `src/components/`

Not implemented yet:

- Real question listing and detail pages
- Answer creation and voting
- Tagging, moderation, and reputation flows
- Search backed by real domain data

## Folder Guide

- `src/app/`: routes, layouts, and page-level composition
- `src/components/`: shared UI and navigation
- `src/lib/`: auth, database, and helpers
- `public/`: static assets

See the README files inside `src/` for more folder-specific notes.

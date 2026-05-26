# Lib Folder

`src/lib/` contains the shared services and domain logic that the routes build on.

## What Lives Here

- auth server and client wiring
- Kysely database types and connection setup
- moderation, posting-policy, and admin helpers
- search, visibility, voting, notification, and messaging support
- rate limiting and settings access
- general utility helpers used across multiple routes

## Important Modules

- `auth.ts` and `auth-client.ts`: Better Auth integration
- `db.ts`: typed Kysely database contract
- `moderation.ts`: quarry roles, posting policies, and review behavior
- `search.ts`: scoped search parsing, access-aware result filtering, and fallback logic for older schemas
- `content.ts`: shared mutation helpers for queries, answers, and chat messages
- `admin.ts`: instance-admin checks
- `visibility.ts`: quarry/profile visibility rules

## Expectations

- Keep shared rules here instead of scattering them across route files.
- Keep the TypeScript database contract aligned with the SQL in `postgres/`.
- Keep this folder free of route-specific presentation code.
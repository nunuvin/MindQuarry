# MindQuarry Copilot Instructions

MindQuarry is being built as a Stack Overflow-like Q&A application.

Current stack:
- The frontend app lives in `mindquarry/` and uses Next.js 15 App Router with React 19 and TypeScript.
- Authentication uses Better Auth with the username and admin plugins.
- Database access uses Kysely on top of PostgreSQL, with auth tables living in the `mqauth` schema.
- UI primitives use Tailwind CSS v4, shadcn/ui conventions, Radix primitives, and Lucide icons.

Working assumptions for changes in this repo:
- Favor incremental work over broad rewrites. Preserve the current structure unless there is a clear reason to change it.
- Treat this as a product codebase, not a demo. New pages and components should support the eventual Q&A workflow of questions, answers, votes, tags, profiles, and moderation.
- Reflect the current implementation honestly. Do not document placeholder UI as complete product behavior.
- Keep auth-sensitive logic on the server when possible. Use client components only where interaction or subscriptions are required.
- Reuse existing utilities and auth wiring before adding new abstractions.
- Keep SQL files aligned with the TypeScript schema definitions in `mindquarry/src/lib/db.ts`.
- Keep local development Windows-compatible. Do not rely on PostgreSQL extensions such as `pg_cron`; schedule app maintenance through Node scripts and documented tasks.
- Treat ESLint warnings as work to finish, not background noise. Fix warnings in touched areas or document a concrete justification before closing the task.
- Before wrapping up a coding task, prefer to leave `npm run build`, `npm test -- --runInBand`, and `npm run test:e2e` passing when the environment supports them.
- When you add or materially change behavior, review the existing Jest and Playwright coverage around that flow and extend it if the current tests would miss the regression.

Repository layout:
- `mindquarry/`: Next.js application.
- `postgres/`: SQL bootstrap and schema files for local PostgreSQL setup.

When adding features:
- Prefer App Router server components by default.
- Put route-level UI and data loading in `mindquarry/src/app`.
- Put reusable UI in `mindquarry/src/components`.
- Put integration code, auth helpers, and database access in `mindquarry/src/lib`.
- Put schema/bootstrap SQL in `postgres/` and document any required manual steps in the relevant README.
- Prefer small, validation-friendly changes. After the first code edit, run the narrowest relevant build, test, or lint check before widening scope.
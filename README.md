# MindQuarry Workspace

MindQuarry is a Stack Overflow-inspired project with a Next.js application and PostgreSQL setup scripts in the same repository.

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

Implemented so far:

- Better Auth is configured in the app and exposed through a Next.js auth route.
- Email/password signup and login pages are present.
- Username-based auth support is enabled through Better Auth plugins.
- A typed Kysely database layer exists for the Better Auth tables in the `mqauth` schema.
- A protected user profile route exists at `mindquarry/src/app/users/[username]`.
- Shared app chrome exists through the navbar, sidebar, and user menu components.

Still early or placeholder:

- The home page is still the default starter page.
- Sidebar destinations are placeholders.
- Core Q&A features such as questions, answers, votes, tags, comments, moderation flows, and search indexing are not implemented yet.

## Where To Work

- See `mindquarry/README.md` for app-specific setup.
- See `postgres/README.md` for the SQL folder purpose.
- See the README files under `mindquarry/src/` for folder-level guidance.

## Copilot Customization

Project instructions live in `.github/`:

- `.github/copilot-instructions.md`: repo-wide engineering guidance.
- `.github/instructions/*.instructions.md`: folder-scoped instructions for app, components, lib, and SQL work.
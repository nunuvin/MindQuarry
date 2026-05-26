# Source Folder

`src/` contains the application code for the MindQuarry Next.js app.

## How The App Is Split

- `app/`: App Router pages, layouts, server actions, and route handlers
- `components/`: shared UI, shell, editors, and reusable interactive pieces
- `lib/`: database access, auth wiring, moderation/search helpers, and other shared services

## Design Intent

This split matters because MindQuarry has both UI-heavy work and policy-heavy work.

- Put route composition, redirects, and page-level loading in `app/`.
- Put reusable presentation or client interaction patterns in `components/`.
- Put database-backed rules and shared domain logic in `lib/`.

That keeps moderation, search, visibility, and account lifecycle logic from leaking into page components.

## Current Focus Areas

The most mature areas of the codebase are:

- auth and identity
- query and answer flows
- messaging
- moderation and posting policies
- visibility-aware search and notification flows

For more detail, see the README files inside each of the three main subfolders.
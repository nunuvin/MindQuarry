---
description: "Use when working in postgres on database bootstrap scripts, auth schema SQL, local Postgres setup, or changes that must stay aligned with the app auth schema."
applyTo: "postgres/**/*.sql"
---

# Postgres Folder Instructions

- Keep these SQL files focused on local bootstrap, extensions, users, schemas, and auth tables.
- The current database contract is driven by Better Auth plus the typed Kysely definitions in `mindquarry/src/lib/db.ts`.
- Prefer additive, reviewable SQL changes over rewriting files without noting intent.
- Use the `mqauth` schema consistently unless there is an intentional migration plan.
- If you add tables for core Q&A features later, document ownership, foreign keys, and how the app layer is expected to query them.
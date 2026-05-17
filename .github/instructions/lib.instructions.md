---
description: "Use when working in mindquarry/src/lib on auth, database access, helper functions, typed integrations, or other shared application services."
applyTo: "mindquarry/src/lib/**/*.ts"
---

# Lib Folder Instructions

- Keep `src/lib` as the source of truth for external integrations and shared application logic.
- Prefer small, explicit helpers over utility dumping grounds.
- Maintain strong typing around database access. If SQL schema changes, keep `db.ts` in sync.
- Better Auth is the chosen auth library. Reuse the existing server `auth` instance and client `authClient` instead of creating parallel auth entry points.
- Session helpers should stay narrow and predictable so pages can compose them safely.
- Do not place route-specific UI logic in this folder.
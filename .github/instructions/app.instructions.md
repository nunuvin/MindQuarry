---
description: "Use when working in mindquarry/src/app on routes, layouts, auth pages, server components, or page-level data loading."
applyTo: "mindquarry/src/app/**/*.{ts,tsx,css}"
---

# App Folder Instructions

- Default to server components for route files unless the page needs browser state, event handlers, or client-only auth subscriptions.
- Keep route files focused on composition, navigation guards, and page-level data loading.
- For auth-protected pages, prefer server-side session checks and redirects before rendering content.
- Treat the current home page and some navigation targets as placeholders. If you extend them, move them toward the Q&A product direction rather than keeping template content.
- When adding data access here, prefer calling small helpers from `src/lib` instead of embedding database details directly in pages.
- Preserve App Router conventions, including colocated route segments and explicit `notFound` or `redirect` handling where needed.
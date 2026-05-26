# App Folder

`src/app/` contains MindQuarry’s App Router surface.

## What Lives Here

This folder owns page-level behavior such as:

- shared layout and navigation wiring
- auth gating and redirects
- feed and quarry pages
- query discussion pages
- settings, notifications, and profiles
- messaging routes
- admin and moderation routes
- route handlers under `api/`

## Important Route Areas

- `layout.tsx`: global shell, session-aware nav, sidebar, and notices
- `page.tsx`: feed and discovery sorts
- `q/`: quarry list, quarry detail, query submission, query discussion, settings, and moderation
- `messages/`: inbox, group creation, and conversation pages
- `admin/`: instance-level admin tools
- `settings/`: account/profile settings
- `api/search/route.ts`: rate-limited search endpoint
- `api/chat/[conversationId]/read` and `stream`: chat read tracking and live updates

## Expectations For Changes Here

- Prefer server components unless the route truly needs browser-only state.
- Keep auth checks and redirects in the route layer.
- Avoid pushing reusable UI patterns down into page files when they belong in `src/components/`.
- Prefer calling shared helpers from `src/lib/` rather than embedding domain logic directly into routes.
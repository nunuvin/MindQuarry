# App Folder

`src/app/` contains the App Router surface for MindQuarry.

## What Is Here Today

- `layout.tsx`: shared shell with navbar and sidebar.
- `page.tsx`: main feed with sorting, previews, and voting.
- `q/page.tsx`: community index.
- `q/[name]/page.tsx`: community detail page and query list.
- `q/[name]/query/[id]/page.tsx`: query discussion thread with answers and voting.
- `messages/`: inbox, compose, and conversation flows.
- `admin/`: global admin surfaces.
- `api/auth/[...all]/route.ts`: Better Auth Next.js handler.
- `api/chat/[conversationId]/read/route.ts` and `stream/route.ts`: chat read receipts and live updates.
- `login/page.tsx`: login form.
- `signup/page.tsx`: signup form.
- `users/[username]/page.tsx`: authenticated profile page.

## Expectations For This Folder

- Prefer server components by default.
- Handle auth gating and redirects at the route layer.
- Keep pages focused on composition and page-level data loading.
- Move reusable UI into `src/components/` instead of duplicating markup across routes.
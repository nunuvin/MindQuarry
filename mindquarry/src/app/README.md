# App Folder

`src/app/` contains the App Router surface for MindQuarry.

## What Is Here Today

- `layout.tsx`: shared shell with navbar and sidebar.
- `page.tsx`: current landing page placeholder.
- `api/auth/[...all]/route.ts`: Better Auth Next.js handler.
- `login/page.tsx`: login form.
- `signup/page.tsx`: signup form.
- `users/[username]/page.tsx`: authenticated profile page.

## Expectations For This Folder

- Prefer server components by default.
- Handle auth gating and redirects at the route layer.
- Keep pages focused on composition and page-level data loading.
- Move reusable UI into `src/components/` instead of duplicating markup across routes.
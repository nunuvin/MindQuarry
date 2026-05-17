# Components Folder

`src/components/` contains reusable UI for the application shell and shared controls.

## What Is Here Today

- `navbar.tsx`: top navigation with search input and session-aware user area.
- `sidebar.tsx`: collapsible sidebar shell.
- `user-menu.tsx`: authenticated user actions.
- `theme-switcher.tsx`: theme UI.
- `ui/`: low-level reusable primitives.

## Conventions

- Keep components presentational or interaction-focused.
- Reuse existing Tailwind and shadcn/ui patterns before adding new styling systems.
- Keep route-specific data loading out of this folder.
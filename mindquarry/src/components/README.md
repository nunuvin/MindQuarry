# Components Folder

`src/components/` contains reusable UI for the application shell and shared controls.

## What Is Here Today

- `navbar.tsx`: top navigation with search input and session-aware user area.
- `sidebar.tsx`: left navigation shell for desktop layouts.
- `user-menu.tsx`: authenticated user actions.
- `TipTapEditor.tsx`: reusable rich-text editor for questions, answers, and chat.
- `TipTapRenderer.tsx`: sanitized renderer for stored rich-text content.
- `theme-switcher.tsx`: theme UI.
- `vote-controls.tsx`: reusable query and answer voting control.
- `ui/`: low-level reusable primitives.

## Conventions

- Keep components presentational or interaction-focused.
- Reuse existing Tailwind and shadcn/ui patterns before adding new styling systems.
- Keep route-specific data loading out of this folder.
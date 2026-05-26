# Components Folder

`src/components/` contains reusable product UI and shared interaction patterns.

## What This Folder Covers

- shell components such as the navbar, sidebar, theme toggle, and user menu
- authoring components such as the TipTap editor and renderer
- reusable interaction controls such as voting and shared form primitives
- small supporting UI building blocks under `ui/`

## Current Notable Components

- `navbar.tsx`: global search entry, notifications, and user entry point
- `sidebar.tsx`: desktop navigation, quarry shortcuts, and instance-admin jump controls
- `user-menu.tsx`: session-aware account menu with outside-click dismissal
- `TipTapEditor.tsx`: shared authoring surface for queries, answers, and chat
- `TipTapRenderer.tsx`: sanitized rich-text rendering
- `theme-switcher.tsx`: shared theme control

## Expectations

- Keep these components reusable and product-facing.
- Avoid moving server-side data loading into this folder.
- Prefer evolving the current softer UI language instead of introducing unrelated styles.
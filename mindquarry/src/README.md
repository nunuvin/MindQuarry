# Source Folder

`src/` contains the application code for the Next.js app.

## Structure

- `app/`: App Router routes, layouts, and route handlers.
- `components/`: reusable UI components and app chrome.
- `lib/`: shared integrations, auth setup, database access, and helpers.

## Current Emphasis

The most developed parts of the codebase today are authentication, feed and query rendering, messaging, and moderation entry points.

Core Q&A product features should be built from here next, using this split:

- routes and page composition in `app/`
- reusable UI in `components/`
- integrations and data access in `lib/`
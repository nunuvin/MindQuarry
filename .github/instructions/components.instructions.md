---
description: "Use when working in mindquarry/src/components on reusable UI, navigation, auth chrome, shadcn-based primitives, or shared interaction patterns."
applyTo: "mindquarry/src/components/**/*.{ts,tsx}"
---

# Components Folder Instructions

- Keep components reusable and product-facing. Prefer generic names and props only when reuse is real.
- Follow the existing stack: Tailwind CSS, shadcn/ui style patterns, Radix primitives, and Lucide icons.
- Keep layout chrome components like the navbar, sidebar, and user menu aware of auth state but not responsible for server-side auth decisions.
- Prefer composition over large prop surfaces.
- Avoid introducing a separate design system unless the current patterns are clearly insufficient.
- If a component is specific to a single route, consider keeping it close to that route instead of promoting it here.
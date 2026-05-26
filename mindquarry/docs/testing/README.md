# Testing MindQuarry

This guide covers the practical day-to-day commands for validating MindQuarry with Jest and Playwright.

## Test Stack

MindQuarry currently uses:

- Jest for unit, component, helper, and route-handler coverage
- Playwright for browser-level end-to-end checks
- `npm run verify` for the full build + Jest + Playwright pass

## Common Commands

Run all Jest tests in-band:

```bash
cd mindquarry
npm test -- --runInBand
```

Run Jest in watch mode while iterating:

```bash
npm run test:watch
```

Run one Jest file:

```bash
npm test -- --runInBand __tests__/chat-client.test.tsx
```

Collect coverage:

```bash
npm run test:coverage
```

Run the Playwright suite:

```bash
npm run test:e2e
```

Run one Playwright spec directly:

```bash
npx playwright test e2e/search.spec.ts
```

Run the complete verification chain:

```bash
npm run verify
```

## Coverage Notes

`npm run test:coverage` writes coverage output using Jest’s configured reporters.

The HTML report is available under:

```text
mindquarry/coverage/lcov-report/index.html
```

This is the fastest way to inspect under-tested areas after a feature pass.

## When To Use Which Tool

Use Jest for:

- helper logic
- route handlers
- component rendering and interaction
- regression coverage for small UI states

Use Playwright for:

- auth flows
- navigation shell behavior
- route-to-route interactions
- browser-only behavior that depends on the real app runtime

## Useful Playwright Commands

Run headed:

```bash
npx playwright test --headed
```

Open the Playwright HTML report after a run:

```bash
npx playwright show-report
```

Open a trace captured by a failed run:

```bash
npx playwright show-trace path/to/trace.zip
```

## Repo-Specific Notes

- Jest route and auth tests rely on the polyfills configured in `jest.env.ts` and `jest.setup.ts`.
- Playwright may print a Next.js warning if the surrounding shell exports a non-standard `NODE_ENV`. That warning is environmental and does not by itself mean the suite failed.
- `npm run verify` is the preferred pre-merge check because it catches build issues that Jest alone will miss.
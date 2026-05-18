# MindQuarry Security Architecture

This document details the security mitigations put in place across the MindQuarry codebase.

## 1. Database & Persistence
- **Schema Separation**: Sensitive user identity info is isolated inside the `mq_auth` schema (maintained by Better-Auth). The primary application runs in the `mq_public` schema. If a SQL vulnerability ever affected a forum route, attackers cannot trivially perform cross-schema joins to access password hashes or sessions.
- **ORM (Kysely)**: All queries are executed using `Kysely`, which translates commands into natively parameterized PostgreSQL queries preventing SQL Injection outright.

## 2. Authorization (IDOR & RBAC)
- **IDOR Protection**: All server actions executing `UPDATE` or `DELETE` perform explicit checks mapping the authenticated `session.user.id` to the requested target.
  - E.g., Moderation endpoints require a query against `quarry_members` to ensure the session holds `role='admin'` for the target `quarry_id`.
- **Global Administrator Mapping**: Defined natively via `first_admin_user_id` inside site settings and the extensible `mq_public.global_admins` table.

## 3. Server-Side Execution & Data Boundaries
- **Server Actions**: Mutations (Form submittals, upvoting) utilize strict Server Actions. Data is extracted via `formData.get()`, bypassing traditional API endpoints which are historically vulnerable to CSRF.
- **DTOs / Payload Stripping**: Server-to-Client transfers intentionally strip down data arrays using `.select(["queries.id", "queries.title" ...])` instead of executing blanket `SELECT *` inside Server Components. This prevents RSC Payload Leakage.

## 4. XSS (Cross Site Scripting) Mitigation
- **DOM Injection**: By default, React/Next.js sanitizes JSX string interpolation.
- **Rich Text Content**: For formatting queries and answers, the system utilizes **TipTap**. During ingestion and rendering, raw HTML is strictly sanitized using `isomorphic-dompurify`. Content rendered via `dangerouslySetInnerHTML` is only ever parsed through DOMPurify first.

## 5. Network Abuse & Rate Limiting
- **Throttling**: MindQuarry utilizes a sliding-window in-memory map limit (`src/lib/rateLimit.ts`) enforcing constraints on highly destructive server actions:
  - Max 5 queries per minute.
  - Max 10 answers per minute.
  - Max 3 new DM initiations per minute.
  - Max 20 messages per minute.
- **Next.js Headers**: Custom Security Headers configured in `next.config.ts`:
  - `Content-Security-Policy`: Blocks execution of external non-whitelisted scripts or objects.
  - `Strict-Transport-Security`: Enforces TLS caching.
  - `X-Frame-Options`: Set to `DENY` preventing clickjacking.

## 6. Open Redirects
- Target parameters passed to native `redirect()` commands execute strictly against relative paths (e.g., `/q/...`) built securely utilizing parameters grabbed directly from Postgres inserts or lookups, rather than echoing unvalidated client inputs.

---
phase: 4
title: Gateway Routing Engine
status: completed
priority: P1
dependencies:
  - 2
---

# Phase 4: Gateway Routing Engine

## Overview
Develop the fast Mock API Gateway using Express or Fastify to capture wildcard traffic, extract parameters, match paths configured in PostgreSQL by `projectSlug`, and log requests.

## Requirements
- Functional:
  - Route interceptor catches wildcard traffic.
  - Route patterns matched (e.g. `/users/:id` matching `/users/123`).
  - Extract parameters, query params, headers, and request body.
  - Automate request log clean-up (pruning logs older than 7 days).
- Non-functional:
  - Highly optimized DB matching querying.
  - Scheduled worker for log cleanup.

## Architecture
- Fastify or Express catch-all router (`/*`) handles mock calls.
- `path-to-regexp` matches configured path strings with path parameters.
- Gateway imports database client directly from the shared workspace package `packages/db`.
- A background cron task or interval checks database every 24 hours to delete stale logs.

## Related Code Files
- Create:
  - `apps/gateway/src/index.ts` (Entrypoint)
  - `apps/gateway/src/matcher.ts` (Dynamic routing matcher utility)
  - `apps/gateway/src/cron.ts` (Scheduled log pruning task)
- Modify:
  - `apps/gateway/package.json` (Depend on `"packages/db"`)

## Implementation Steps
1. Bootstrap Express/Fastify application with TypeScript in `/apps/gateway`.
2. Link the shared workspace package `packages/db` as a dependency in Gateway's `package.json`.
3. Register wildcard middleware to intercept all requests.
4. Extract `projectSlug` from prefix path (e.g., `/mock/:projectSlug/*`).
5. Query all paths defined by the corresponding project slug from the database (using Prisma `where: { project: { slug: projectSlug } }`).
6. Match the requested path using `path-to-regexp` to support dynamic parameters (e.g., `/users/:id` extracts `{ id: "123" }`).
7. Parse query parameters, body payloads (JSON, raw string), and request headers.
8. Implement the background pruning task in `apps/gateway/src/cron.ts`:
   - Initialize a daily cron task or background interval that executes:
     ```typescript
     const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
     await prisma.apiLog.deleteMany({ where: { timestamp: { lt: sevenDaysAgo } } });
     ```
   - Ensure an index exists on `ApiLog(timestamp)` to keep delete queries high-performance.

## Success Criteria
- [ ] Gateway runs on port 3001.
- [ ] Requests to `http://localhost:3001/mock/:projectSlug/test-path` correctly resolve to the database entry.
- [ ] Dynamic parameter matching behaves correctly (e.g., matching `/items/:id` extracts `{ id: "123" }`).
- [ ] The log pruning utility boots up and prunes database logs older than 7 days successfully.

## Risk Assessment
- *High database load during pattern matching*: Mitigate by fetching endpoints for the requested project slug and caching them locally.
- *Log pruning locks database table*: Handled by scheduling the pruning task during off-peak hours and utilizing indexes on the timestamp column.


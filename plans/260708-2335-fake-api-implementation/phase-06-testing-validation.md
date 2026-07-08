---
phase: 6
title: Testing & Validation
status: completed
priority: P2
dependencies:
  - 5
---

# Phase 6: Testing & Validation

## Overview
Perform End-to-End integration tests on the completed system, configure the Caddyfile reverse proxy with correct basePath prefixes, and test the full multi-container Docker setup.

## Requirements
- Functional:
  - System operates unified under a single domain using path routing.
  - Endpoints resolve, execute, and display logs in dashboard.
  - Next.js static assets and Auth APIs resolve correctly.
- Non-functional:
  - Automated test coverage validating the core features.
  - Verify container startup health checks and recovery flows.

## Architecture
- Caddy acts as reverse proxy, routing `/dashboard` and `/dashboard/*` (which encapsulates dynamic Next.js static asset routes like `/dashboard/_next/*` and API routes like `/dashboard/api/auth/*`) to Next.js dashboard container.
- Catch-all fallback (`/*`) routes to Gateway.
- Docker Compose encapsulates all services with strict dependency checks.

## Related Code Files
- Create:
  - `Caddyfile` (root proxy config)
  - `tests/e2e.test.ts` (Integration tests)
- Modify:
  - `docker-compose.yml` (final service configuration)

## Implementation Steps
1. Configure `Caddyfile` to proxy:
   - `/dashboard` and `/dashboard/*` to Next.js (`http://dashboard:3000`).
   - Catch-all fallback (`/*`) to Gateway (`http://gateway:3001`).
2. Write integration tests verifying:
   - User creation and dashboard token generation.
   - Endpoint configuration storage under projects.
   - Call Mock API and assert correct dynamic Javascript execution in worker threads.
   - Log entry insertion and async log buffer flushing.
3. Test full stack orchestration with `docker-compose up` verifying postgres health check wait dependencies.
4. Verify that the daily log rotation cron task correctly sweeps database logs older than 7 days.
5. Perform a simulated load test (e.g. 50 concurrent requests containing infinite loops) and verify:
   - Timeout halts loop execution cleanly inside workers.
   - Gateway main thread remains responsive.
   - Request logs flush successfully without exhausting database pools.
   - Rate limit blocks excess calls.

## Success Criteria
- [ ] Running `docker-compose up -d` boots all containers successfully in sequence.
- [ ] Caddy proxies all assets, APIs, and mock routes correctly on a single exposed port.
- [ ] Integration tests verify: auth, projects CRUD, routing params, dynamic scripts in workers, async database logging, and rate limits.

## Risk Assessment
- *Caddy SSL setup failure on VPS*: Solved by utilizing standard HTTP routing locally and relying on Caddy's auto-HTTPS feature on the target host (domain registration pointing to VPS IP).

---
title: Fake API Application Implementation
description: >-
  Implementation of a self-hosted Fake API system using a Next.js Dashboard and
  a fast Fastify/Express Mock Gateway separated via Docker Compose, including
  secure sandboxed JS script execution.
status: completed
priority: P1
branch: main
tags:
  - nextjs
  - express
  - prisma
  - quickjs
  - docker
blockedBy: []
blocks: []
created: '2026-07-08T16:34:03.335Z'
createdBy: 'ck:plan'
source: skill
---

# Fake API Application Implementation Plan

## Overview
This plan describes the development of a self-hosted mock API application. It consists of:
1. **Management Dashboard (Next.js + Tailwind + Prisma)**: Allowing users to register, log in, configure mock endpoints, and watch real-time API logs.
2. **Mock API Gateway (Express/Fastify + quickjs-emscripten)**: Intercepting incoming client mock requests, performing pattern routing/matching, executing isolated scripts for custom responses, and logging requests to PostgreSQL.
3. **Database (PostgreSQL)**: Storing configurations, users, and request logs.
4. **Reverse Proxy (Caddy/Nginx)**: Directing traffic under `api-fake.reidev.life` (`/dashboard/*` to Dashboard, everything else to the Mock Gateway).

## Phases

| Phase | Name | Status | Priority | Description |
|-------|------|--------|----------|-------------|
| 1 | [Setup Monorepo & Environment](./phase-01-setup-monorepo-environment.md) | Completed | P1 | Setup npm workspaces, TS, and basic Docker Compose environment. |
| 2 | [Database & Auth](./phase-02-database-auth.md) | Completed | P1 | Define DB schema, run Prisma migrations, and set up Dashboard Authentication. |
| 3 | [Dashboard UI & Logs](./phase-03-dashboard-ui-logs.md) | Completed | P2 | Build front-end management console and log viewers. |
| 4 | [Gateway Routing Engine](./phase-04-gateway-routing-engine.md) | Completed | P1 | Implement gateway capture engine with wildcard pattern matching. |
| 5 | [Sandboxed Scripting](./phase-05-sandboxed-scripting.md) | Completed | P1 | Integrate `quickjs-emscripten` for safe script evaluation and delay logic. |
| 6 | [Testing & Validation](./phase-06-testing-validation.md) | Completed | P2 | Run E2E tests, configure reverse proxy routing, and finalize VPS setup. |

## Dependencies
None. This is a greenfield project setup.

## Success Criteria
- Fully containerized app running with `docker-compose up`.
- Dashboard is secure and allows full endpoint CRUD management.
- Dynamic script execution terminated gracefully on loop/timeout.
- Live-logging of all intercepted requests displayed on the Dashboard.

## Red Team Review

### Session — 2026-07-08
**Findings:** 11 (10 accepted, 1 rejected)
**Severity breakdown:** 4 Critical, 6 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Caddy routing collision / Dashboard static asset starvation | Critical | Accept | Completed |
| 2 | Monorepo Prisma client drift and Docker build errors | Critical | Accept | Completed |
| 3 | Lack of authorization / IDOR vulnerabilities in Dashboard | Critical | Accept | Completed |
| 4 | Technical terms mismatch (JVM heap) & WASM RAM leak | Critical | Accept | Completed |
| 5 | Missing Project model & user ID disclosure in URLs | High | Accept | Completed |
| 6 | Event Loop blocking DoS during dynamic script execution | High | Accept | Completed |
| 7 | DB Connection Pool exhaustion from sync logging | High | Accept | Phase 5 |
| 8 | Docker Compose startup race conditions | High | Accept | Phase 1, Phase 6 |
| 9 | Slowloris DoS via uncapped latency delays | High | Accept | Phase 5 |
| 10| Ghost Log pruning cron task missing implementation | High | Accept | Phase 4 |
| 11| Sandbox execution deemed over-engineering | High | Reject | N/A (Keep WASM sandbox) |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-..., phase-02-..., phase-03-..., phase-04-..., phase-05-..., phase-06-...
- Decision deltas checked: 10
- Reconciled stale references: 10
- Unresolved contradictions: 0


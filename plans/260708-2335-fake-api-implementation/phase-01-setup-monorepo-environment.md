---
phase: 1
title: Setup Monorepo & Environment
status: completed
priority: P1
dependencies: []
---

# Phase 1: Setup Monorepo & Environment

## Overview
Initialize the project directory as an npm workspace monorepo containing the Dashboard app, Mock Gateway app, and a shared Database package, setting up a shared TypeScript config and basic Docker environment.

## Requirements
- Functional: Establish a build system where both apps and the shared database package compile cleanly. Configure Next.js dashboard prefix to prevent proxy conflicts.
- Non-functional: Maintain a clean project structure using npm workspaces, with robust container start dependencies.

## Architecture
- Root `package.json` manages workspaces (`apps/*` and `packages/*`).
- `packages/db` contains the Prisma schema, database utilities, and exports a unified Prisma Client.
- Docker Compose orchestrates local/VPS deployment, waiting for database availability via healthchecks.

## Related Code Files
- Create:
  - `package.json` (root)
  - `tsconfig.json` (root)
  - `docker-compose.yml` (root)
  - `.env.example` (root)
  - `apps/dashboard/package.json`
  - `apps/dashboard/next.config.js` (with `basePath: '/dashboard'`)
  - `apps/gateway/package.json`
  - `packages/db/package.json`
  - `packages/db/prisma/schema.prisma`

## Implementation Steps
1. Create root `package.json` with npm workspaces configured:
   ```json
   {
     "name": "api-fake-monorepo",
     "private": true,
     "workspaces": [
       "apps/*",
       "packages/*"
     ],
     "scripts": {
       "build:db": "npm run build -w packages/db",
       "build:dashboard": "npm run build -w apps/dashboard",
       "build:gateway": "npm run build -w apps/gateway",
       "build": "npm run build:db && npm run build:dashboard && npm run build:gateway"
     }
   }
   ```
2. Create root `tsconfig.json` and base compiler configurations.
3. Scaffold Next.js application in `/apps/dashboard` and create `apps/dashboard/next.config.js` with:
   ```javascript
   module.exports = {
     basePath: '/dashboard',
     assetPrefix: '/dashboard',
   }
   ```
4. Scaffold Express/Fastify application in `/apps/gateway`.
5. Scaffold database package in `/packages/db` to share database schemas and runtime Prisma clients.
6. Create a `docker-compose.yml` specifying:
   - `db` (PostgreSQL 16 with healthcheck testing database connection readiness)
   - `dashboard` (Next.js, depends on `db` service_healthy)
   - `gateway` (Express/Fastify, depends on `db` service_healthy)
   - `caddy` (Caddy reverse proxy configured to route `/dashboard` and `/dashboard/*` to Dashboard, and `/*` to Gateway)

## Success Criteria
- [ ] Running `npm run build` compiles database, dashboard, and gateway successfully.
- [ ] `docker-compose config` verifies healthy service dependencies.
- [ ] Environment variable skeleton loaded via `.env.example`.

## Risk Assessment
- *Docker networking conflict*: Solved by utilizing Caddy container on the same Docker bridge network to handle port forwarding.
- *Race condition at container boot*: Solved by PG healthchecks and application service dependency constraints.

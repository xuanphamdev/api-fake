# Antigravity Fake API Service

A self-hosted, safe, and dynamic mock API generation service built with Next.js, Express, PostgreSQL, and WebAssembly-sandboxed QuickJS.

## Features
- **Sleek Dark Dashboard**: Visual management for Projects and Endpoints with full CSRF/IDOR protection.
- **Dynamic Routing**: Express Gateway matches dynamic path params (e.g. `/users/:id/posts/:postId`) using `path-to-regexp`.
- **WASM-Sandboxed Custom Scripting**: Safe execution of user-supplied JavaScript inside a WebAssembly QuickJS sandbox (`quickjs-emscripten`) running on background Worker Threads. Capped at 100ms CPU execution limits and 8MB RAM.
- **Async Logs Monitor**: Intercepted API calls logged asynchronously in background batches to prevent connection pool exhaustion.
- **Auto Cleanup**: Background cron prunes logs older than 7 days daily.
- **Simple Deployment**: Preconfigured Caddy reverse proxy and database health-checked Docker Compose setup.

## Project Structure
```
api-fake/
├── apps/
│   ├── dashboard/       # Next.js 14 Web UI & Session management API
│   └── gateway/         # Express Mock Engine with WebAssembly worker sandbox
├── packages/
│   └── db/              # Shared Prisma Schema and Database Client library
├── docker/              # Dockerfiles for monorepo packaging
├── scripts/             # Integration tests and utility scripts
├── docker-compose.yml   # Multi-service configuration
└── Caddyfile            # Reverse proxy traffic routing
```

## Quick Start

### 1. Requirements
Ensure you have Docker and Node.js 20+ installed on your host.

### 2. Run Local Development (Hot Reload)
1. Install workspaces dependencies:
   ```bash
   npm install
   ```
2. Spin up the PostgreSQL database in Docker:
   ```bash
   docker-compose up -d db
   ```
3. Run migrations on the local database:
   ```bash
   npx prisma migrate dev --schema=packages/db/prisma/schema.prisma
   ```
4. Start development servers:
   - Dashboard: `npm run dev -w apps/dashboard` (runs on http://localhost:3000/dashboard)
   - Gateway: `npm run dev -w apps/gateway` (runs on http://localhost:3001)

### 3. Production Deployment (Docker Compose)
To compile and spin up the complete production-ready services:
```bash
docker-compose up -d --build
```
This boots Caddy on port 80.
- Dashboard Management: Access `http://localhost/dashboard`
- Mock Endpoints: Accessed via `http://localhost/mock/:projectSlug/*`

## Running Tests
To run the automated End-to-End integration test suite locally:
```bash
node --env-file=.env scripts/test-e2e.js
```

## License

Copyright 2026 Sean (seandck).

Licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

You are free to **self-host, use, modify, and redistribute** this software for
**any noncommercial purpose** — personal projects, research, education, and
nonprofit/government use are all permitted. **Commercial use is not permitted**
under this license. For a commercial license, contact the maintainer.

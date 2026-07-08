# Red Team Plan Review: Assumption Destroyer & Scope Auditor Report

**Project:** Fake API Application Implementation  
**Reviewer Role:** Scope Auditor / Assumption Destroyer  
**Review Date:** 2026-07-08  
**Local Time:** 23:35:45+07:00

---

## Finding 1: Caddy Routing Collision and Incomplete Path Mapping for Next.js Dashboard
- **Severity:** Critical
- **Location:** Phase 1, section "Implementation Steps" (lines 50-54) and Phase 6, section "Implementation Steps" (lines 33-35)
- **Flaw:** The plan configures Caddy to route `/dashboard/*` to the Next.js application (`dashboard`) and the catch-all `/*` to the gateway application (`gateway`). It fails to account for Next.js internal assets, client-side hydration resources, API routes, and standard authentication endpoints.
- **Failure scenario:** 
  Next.js requires access to static and system paths such as `/_next/*` (for JS bundle chunks, CSS, and images) and root-relative authentication routes like `/login` or `/api/auth/*`. Under the proposed Caddy rules, any request to `/_next/*` or `/login` will match the catch-all `/*` and be forwarded to the Mock Gateway. The Mock Gateway will treat these as mock route matches and return 404s or execute mock scripts, causing the dashboard frontend to completely fail to load styles, scripts, or login/logout functionalities.
- **Evidence:**
  - [phase-01-setup-monorepo-environment.md:54](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-01-setup-monorepo-environment.md#L54): `caddy (Caddy reverse proxy configured for routing /dashboard/* to Dashboard, and /* to Gateway).`
  - [phase-06-testing-validation.md:33-35](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-06-testing-validation.md#L33-L35):
    ```markdown
    1. Configure Caddyfile to proxy:
       - /dashboard and /dashboard/* to Next.js (http://dashboard:3000).
       - Catch-all fallback (/*) to Gateway (http://gateway:3001).
    ```
  - [phase-02-database-auth.md:40](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-02-database-auth.md#L40): `5. Create Next.js middleware to check JWT/session cookie and redirect unauthenticated users to /login.`
- **Suggested fix:** 
  Explicitly route Next.js system directories (`/_next/*` and static directories) and root auth routes (`/login`, `/register`, `/api/auth/*`) to the dashboard service, or configure Next.js with a base path of `/dashboard` and configure the asset prefix in `next.config.js` to ensure all assets are served under `/dashboard/_next`.

---

## Finding 2: Missing Database Model Fields and Relations for User/Project Isolation in Gateway
- **Severity:** High
- **Location:** Phase 2, section "Implementation Steps" (line 36) and Phase 4, section "Implementation Steps" (lines 37-38)
- **Flaw:** The database schema defined in Phase 2 only defines `User`, `Endpoint`, and `ApiLog` models, and is completely silent on any relationship between them (such as owner context). However, Phase 4 states that the Gateway will extract `projectId` from incoming routes (`/mock/:projectId/*`) and filter the DB query accordingly.
- **Failure scenario:** 
  When the Gateway processes a request like `/mock/123/users`, it attempts to parse the `projectId` as `"123"` and query the database for endpoints associated with that project. Because Phase 2 defines no `Project` model and no `projectId` field on the `Endpoint` table, the query will result in database execution runtime syntax errors (e.g., column does not exist) or return all users' endpoints indiscriminately. This leads to a total operational failure or severe cross-tenant data leaks.
- **Evidence:**
  - [phase-02-database-auth.md:36](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-02-database-auth.md#L36): `1. Initialize Prisma inside /apps/dashboard and specify the database schema (User, Endpoint, ApiLog).`
  - [phase-04-gateway-routing-engine.md:37-38](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L37-L38):
    ```markdown
    4. Extract user identity or project context from prefix path (e.g., /mock/:projectId/*).
    5. Query all paths defined by the corresponding user/project from the DB.
    ```
- **Suggested fix:** 
  Update Phase 2 to explicitly detail the database model properties and relationships: either add a `Project` table with a relationship to `Endpoint` and `User`, or add a `userId` field to the `Endpoint` model and change the gateway pattern routing prefix to extract the user context rather than a non-existent `projectId`.

---

## Finding 3: Severe WebAssembly Memory Leaks and Context Pollution in QuickJS Sandbox
- **Severity:** High
- **Location:** Phase 5, section "Requirements" (line 21), "Implementation Steps" (lines 38-39), and "Risk Assessment" (line 54)
- **Flaw:** The plan specifies caching the "QuickJS module instance globally" for performance, references "JVM heap limits" (a conceptual error for a C/WASM-based engine), and fails to outline any WebAssembly handle memory disposal or context isolation protocols.
- **Failure scenario:** 
  1. **Memory Leak:** `quickjs-emscripten` operates on a compiled C heap inside WebAssembly. Because JavaScript garbage collection cannot track and reclaim allocations made inside the WASM linear memory, every handle (like `QuickJSContext`, runtime instances, and variables) passed between the JS host and guest must be manually disposed of using `.dispose()`. Since Phase 5 does not establish a `try...finally` disposal protocol, the WASM memory pool will leak rapidly on every incoming request, leading to rapid heap exhaustion and Node process OOM crashes under normal traffic load.
  2. **State Pollution:** If caching the "QuickJS module instance globally" results in sharing a single `QuickJSContext` across request handlers, concurrent request executions will access and pollute a shared global environment, causing cross-request variable injection or cross-tenant data leaks.
- **Evidence:**
  - [phase-05-sandboxed-scripting.md:21](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L21): `- Memory: JVM heap limits capped at 8MB.`
  - [phase-05-sandboxed-scripting.md:54](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L54): `- WASM instance initialization overhead: Caching the QuickJS module instance globally (rather than reload WASM binary each request) keeps execution latency under 10ms.`
- **Suggested fix:** 
  1. Correct "JVM heap limits" to "WASM memory limits".
  2. Clarify that while the compiled WebAssembly *binary* is cached globally, a new `QuickJSContext` must be initialized *per request* to guarantee state isolation.
  3. Mandate that all sandbox logic wraps the context execution inside a `try...finally` block that calls `.dispose()` on the context and all generated handles.

---

## Finding 4: Workspace Build Failures and Direct Prisma Schema Import in Dockerized Monorepo
- **Severity:** High
- **Location:** Phase 1, section "Architecture" (line 19) and Phase 4, section "Related Code Files" (line 31) and "Implementation Steps" (line 35)
- **Flaw:** The plan assigns the single `schema.prisma` file to `apps/dashboard/prisma/schema.prisma` but requires the gateway application (`apps/gateway`) to connect using its own Prisma Client instance (`apps/gateway/src/db.ts`). It fails to define how the gateway accesses the schema file to compile its database client during separate container builds.
- **Failure scenario:** 
  When building the Docker image for the gateway service, the build context typically copies only `/apps/gateway` (or the monorepo structure is not cleanly mapped in the Dockerfile). Running `npx prisma generate` inside the gateway container will fail because the schema file is nested under `/apps/dashboard/prisma/schema.prisma` which is excluded or inaccessible. If the build copies the whole repository to bypass this, any change to dashboard UI code will invalidate Docker build caches for the gateway container, causing extremely slow builds and deployment blockages.
- **Evidence:**
  - [phase-02-database-auth.md:28](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-02-database-auth.md#L28): `  - apps/dashboard/prisma/schema.prisma`
  - [phase-04-gateway-routing-engine.md:31](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L31): `  - apps/gateway/src/db.ts (Prisma Client instance)`
  - [phase-04-gateway-routing-engine.md:35](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L35): `2. Connect to the shared PostgreSQL database using Prisma Client.`
- **Suggested fix:** 
  Move the database logic and schema to a shared npm workspace package (e.g., `packages/db`) at the root level, which exposes the generated Prisma Client as an import. Ensure both the `dashboard` and `gateway` consume this package, and configure Docker Compose build contexts from the root workspace directory.

---

## Finding 5: Ghost Log Pruning Dependency (Missing Implementation)
- **Severity:** High
- **Location:** Phase 6, section "Implementation Steps" (line 42)
- **Flaw:** The plan lists validating the log rotation and clean-up task as a success/test criteria in Phase 6, but completely omits implementing any log pruning mechanism, script, cron worker, or database trigger in any of the earlier phases.
- **Failure scenario:** 
  During integration and validation, the clean-up task verification will fail because there is no task or daemon defined to run it. In production, this missing implementation will cause the `ApiLog` table in PostgreSQL to grow unboundedly, leading to database disk exhaustion or severe query latency degradation during dashboard log lookups.
- **Evidence:**
  - [phase-06-testing-validation.md:42](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-06-testing-validation.md#L42): `4. Validate that log rotation/clean-up task runs to prune logs older than 7 days.`
  - (No implementation instructions, worker daemon setups, or scripts are included in Phase 1 through Phase 5.)
- **Suggested fix:** 
  Include a concrete step in Phase 2 or Phase 4 to construct the log pruning worker (such as a node-cron helper script in the gateway service, or a PostgreSQL scheduled event) and list its source file and execution context clearly in the plans.

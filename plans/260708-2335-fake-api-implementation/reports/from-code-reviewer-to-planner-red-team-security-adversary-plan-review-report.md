# Adversarial Plan Review Report: Security Adversary & Fact Checker

This report contains an adversarial review of the Fake API Application Implementation Plan. The review adopts a Security Adversary perspective (focusing on authentication bypass, injection, data exposure, privilege escalation, and DoS vectors) and serves as a Fact Checker to verify the structural integrity of the proposed architecture.

---

## Finding 1: Lack of Multi-Tenant Authorization and IDOR Vulnerabilities in Dashboard Actions
- **Severity:** Critical
- **Location:** Phase 3, section "Implementation Steps"
- **Flaw:** The plan fails to define tenant ownership checks for mock endpoints and request logs. The implementation steps only describe creating general views and CRUD forms, without specifying that access to a given endpoint or log must be restricted to the user who created it.
- **Failure scenario:** A logged-in user can access the edit page, send a GET/PUT/DELETE request, or query request logs for any endpoint ID in the system (e.g. `/api/dashboard/endpoints/1234` or `/dashboard/logs/5678`) by guessing or brute-forcing IDs. Since there is no authorization check verifying if the endpoint/log belongs to the authenticated session user, this leads to complete data exposure, unauthorized modification, and deletion of other users' mock APIs.
- **Evidence:**
  - `plans/260708-2335-fake-api-implementation/phase-03-dashboard-ui-logs.md` lines 27-32:
    ```markdown
    27:   - `apps/dashboard/src/app/dashboard/layout.tsx` (Sidebar & Navigation)
    28:   - `apps/dashboard/src/app/dashboard/endpoints/page.tsx` (List view)
    29:   - `apps/dashboard/src/app/dashboard/endpoints/new/page.tsx` (Creation form)
    30:   - `apps/dashboard/src/app/dashboard/endpoints/[id]/page.tsx` (Edit form)
    31:   - `apps/dashboard/src/app/dashboard/logs/page.tsx` (Log list)
    32:   - `apps/dashboard/src/app/dashboard/logs/[id]/page.tsx` (Log detail modal/view)
    ```
  - `plans/260708-2335-fake-api-implementation/phase-03-dashboard-ui-logs.md` line 43:
    ```markdown
    43: 4. Build Request Log list with filtering and search capabilities (sort by time, search by path).
    ```
- **Suggested fix:** Enforce that all DB queries for endpoints and logs include a `userId` filter matching the authenticated session. In Next.js Server Actions or API routes, validate that the requested resource is owned by the current session's `userId` before performing any read or write operation.

---

## Finding 2: Routing Conflict Leading to Breakage of Authentication APIs and Dashboard Asset Loading
- **Severity:** Critical
- **Location:** Phase 6, section "Implementation Steps"
- **Flaw:** The Caddy reverse proxy configuration routes only `/dashboard` and `/dashboard/*` to the Dashboard app, while sending everything else (`/*`) to the Gateway. Since the Dashboard app is built with Next.js, its static assets (`/_next/static/*`) and API routes (like `/api/auth/*` created in Phase 2) will be routed to the Gateway catch-all router. The plan does not specify configuring a `basePath` in Next.js.
- **Failure scenario:** When a user visits the dashboard, the page attempts to fetch JavaScript assets from `/_next/static/...` and authenticate via `/api/auth/login`. Because these paths do not start with `/dashboard`, Caddy routes them to the Mock Gateway (`http://gateway:3001`). The Gateway intercepts them as dynamic mock requests, causing the Dashboard UI to fail to load (asset starvation) and authentication requests to fail, making the application completely unusable.
- **Evidence:**
  - `plans/260708-2335-fake-api-implementation/phase-06-testing-validation.md` lines 33-35:
    ```markdown
    33: 1. Configure `Caddyfile` to proxy:
    34:    - `/dashboard` and `/dashboard/*` to Next.js (`http://dashboard:3000`).
    35:    - Catch-all fallback (`/*`) to Gateway (`http://gateway:3001`).
    ```
  - `plans/260708-2335-fake-api-implementation/phase-02-database-auth.md` lines 29-31:
    ```markdown
    29:   - `apps/dashboard/src/app/api/auth/register/route.ts`
    30:   - `apps/dashboard/src/app/api/auth/login/route.ts`
    31:   - `apps/dashboard/src/app/api/auth/logout/route.ts`
    ```
- **Suggested fix:** Configure Next.js with `basePath: '/dashboard'` in `next.config.js` to ensure all assets and APIs are prefixed. Alternatively, update the Caddyfile to explicitly route `/_next/*` and `/api/*` to the Dashboard service.

---

## Finding 3: Schema-Architecture Mismatch and Information Disclosure via Exposed User IDs in Gateway URLs
- **Severity:** High
- **Location:** Phase 2, section "Implementation Steps" and Phase 4, section "Implementation Steps"
- **Flaw:** The database schema defined in Phase 2 only contains `User`, `Endpoint`, and `ApiLog` models, with no mention of a `Project` model. However, Phase 4 plans to extract `projectId` from the Gateway URL (`/mock/:projectId/*`) to query the database.
- **Failure scenario:** If developers implement the schema as written, they will have to use the internal `User` ID as the `projectId` in mock URLs to map endpoints to users. This exposes internal user database identifiers in public Gateway URLs. Alternatively, if a separate `projectId` is expected, the schema is missing the `Project` model, leading to compile/migration errors when trying to run database queries matching a non-existent field.
- **Evidence:**
  - `plans/260708-2335-fake-api-implementation/phase-02-database-auth.md` line 36:
    ```markdown
    36: 1. Initialize Prisma inside `/apps/dashboard` and specify the database schema (`User`, `Endpoint`, `ApiLog`).
    ```
  - `plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md` line 37:
    ```markdown
    37: 4. Extract user identity or project context from prefix path (e.g., `/mock/:projectId/*`).
    ```
- **Suggested fix:** Update the database schema to include a `Project` model (or a specific unique API key/tenant token identifier for mock endpoints) that is separate from internal user IDs, and ensure it is created and migrated during Phase 2.

---

## Finding 4: Event Loop Starvation and CPU Denial of Service (DoS) via Main-Thread Sandbox Execution
- **Severity:** High
- **Location:** Phase 5, section "Implementation Steps"
- **Flaw:** The plan executes guest JS scripts inside `quickjs-emscripten` on the main thread of the Gateway's Fastify/Express application. Even though the plan enforces a 100ms timeout limit using QuickJS interrupts, running CPU-intensive scripts synchronously blocks the single-threaded Node.js event loop during that 100ms window.
- **Failure scenario:** An attacker configures a mock endpoint with an infinite loop script (e.g., `while(true) {}`) and sends a small volume of concurrent requests (e.g., 20 requests). Each request blocks the main event loop thread for 100ms, completely freezing the Gateway and preventing it from handling any other incoming requests, causing a severe Denial of Service (DoS) for all users.
- **Evidence:**
  - `plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md` lines 39-41:
    ```markdown
    39:    - Set execution interrupts to enforce execution time limits (100ms limit).
    40: 3. Implement execution logic in `index.ts`:
    41:    - If the endpoint has a script, execute it in the sandbox.
    ```
- **Suggested fix:** Offload the sandbox execution to a pool of Node.js Worker Threads (`worker_threads`) or a separate microservice so that heavy CPU utilization does not block the Gateway's main event loop.

---

## Finding 5: Slowloris Connection Exhaustion DoS via Unthrottled Latency Delays
- **Severity:** High
- **Location:** Phase 3, section "Implementation Steps" and Phase 5, section "Implementation Steps"
- **Flaw:** The plan allows users to configure a custom latency delay of up to 10,000ms (10 seconds) per endpoint, implemented using a standard `setTimeout` on the Gateway before responding. There is no plan for connection throttling, rate-limiting, or capping concurrent delayed connections.
- **Failure scenario:** An attacker sends a flood of requests to a mock endpoint configured with a 10-second delay. Since each request is held open in a `setTimeout` callback, the Node.js process and proxy (Caddy) quickly exhaust their socket connection pools, file descriptors, and memory, resulting in a Slowloris-style Denial of Service (DoS) where legitimate users cannot connect to the Gateway.
- **Evidence:**
  - `plans/260708-2335-fake-api-implementation/phase-03-dashboard-ui-logs.md` line 41:
    ```markdown
    41:    - Delay slider (0 to 10,000ms).
    ```
  - `plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md` line 43:
    ```markdown
    43:    - Apply configured latency delay (e.g. `setTimeout` for delay value in ms) before returning the response to the user.
    ```
- **Suggested fix:** Implement strict rate-limiting on client requests, restrict the maximum delay to a lower default (e.g., 2,000ms), and cap the number of concurrent open connections per project or client IP.

# Adversarial Plan Review: Red Team Failure Mode Analyst & Flow Tracer Report

This report evaluates the **Fake API Application Implementation Plan** through a hostile lens. It details critical flaws, async ordering risks, cascading failure paths, and resource starvation vulnerabilities.

---

## Finding 1: Connection Pool Starvation and Cascading Failure due to Synchronous Logging Writes
- **Severity:** High
- **Location:** Phase 5, section "Implementation Steps"
- **Flaw:** The plan blocks the HTTP request-response cycle on synchronous database writes for request logging (`ApiLog`) without buffering, batching, or asynchronous queuing.
- **Failure scenario:** Under heavy load (e.g., load testing a mocked endpoint), the gateway will attempt to write an `ApiLog` entry to PostgreSQL synchronously for every incoming request. This will quickly exhaust the PostgreSQL/Prisma database connection pool. Because the gateway and dashboard share the same database instance, this database connection starvation will cascade, crashing both the Mock Gateway and the Management Dashboard.
- **Evidence:** [phase-05-sandboxed-scripting.md:44](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L44) ("Record request log (`ApiLog` table) containing all matching results, performance metrics, and logs.")
- **Suggested fix:** Decouple request completion from log persistence. Implement a background log-flushing system using an in-memory queue (or a queue like BullMQ) to batch log writes asynchronously, preventing database connection starvation under high throughput.

---

## Finding 2: WebAssembly Heap Memory Leaks leading to Gateway Process Crash
- **Severity:** High
- **Location:** Phase 5, section "Implementation Steps"
- **Flaw:** The plan describes creating QuickJS runtime instances, contexts, and host objects/callbacks without any strategy for explicit WASM handle disposal.
- **Failure scenario:** Every request executing a dynamic script allocates memory in the WebAssembly heap (for the runtime, context, injected `req` handles, and callback functions). Because WebAssembly heap allocations are not managed by the V8 garbage collector, they must be manually disposed of. Failing to call `.dispose()` on all QuickJS handles and VM instances inside `sandbox.ts` will leak WASM heap memory rapidly. This will eventually lead to an out-of-memory crash of the entire gateway process, rendering the system offline.
- **Evidence:** [phase-05-sandboxed-scripting.md:35-39](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L35-L39) (Describes initializing the VM and injecting parameters but lacks any instructions for cleanup or resource disposal).
- **Suggested fix:** Mandate the use of strict `try...finally` resource clean-up blocks or explicit `using` statements (TypeScript 5.2+) inside the execution runner in `sandbox.ts` to ensure `vm.dispose()`, `runtime.dispose()`, and all intermediate value handles are guaranteed to be cleaned up after execution.

---

## Finding 3: Broken Monorepo Dependency Flow and Compile-Time Schema Desynchronization
- **Severity:** Critical
- **Location:** Phase 4, section "Related Code Files" and "Implementation Steps"
- **Flaw:** The Prisma schema is located exclusively within the dashboard workspace, but the gateway workspace requires access to compile its own Prisma client (`apps/gateway/src/db.ts`) without any configured dependency or build flow sharing the schema.
- **Failure scenario:** When running `npm run build` at the monorepo root, the build process for the gateway will fail because `apps/gateway/src/db.ts` cannot import or compile against a non-existent or ungenerated Prisma Client. Even if generated locally in development, during separate Docker container builds, the gateway container will not have physical access to the schema file inside the dashboard directory.
- **Evidence:**
  - [phase-02-database-auth.md:28](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-02-database-auth.md#L28) (Schema defined under `apps/dashboard/prisma/schema.prisma`)
  - [phase-04-gateway-routing-engine.md:31](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L31) (Gateway initializes Prisma Client in `apps/gateway/src/db.ts` with no local schema or dependency link)
- **Suggested fix:** Move the Prisma schema and database configuration into a shared internal workspace package (e.g. `packages/database`) that both `apps/dashboard` and `apps/gateway` depend on in their respective `package.json` configurations.

---

## Finding 4: Docker Compose Startup Race Condition and Startup Crash Loop
- **Severity:** High
- **Location:** Phase 6, section "Implementation Steps"
- **Flaw:** No boot orchestration or wait checks are defined to prevent services from attempting to connect to PostgreSQL before it is healthy and before migrations are finished.
- **Failure scenario:** Executing `docker-compose up` will spin up the `db`, `dashboard`, and `gateway` containers concurrently. PostgreSQL takes several seconds to boot and accept connections. The `dashboard` and `gateway` containers will immediately attempt to connect to the database to run migrations or queries, resulting in connection exceptions and container crashes. Additionally, the gateway may boot and fail queries if the dashboard's schema migration step has not yet finished executing.
- **Evidence:**
  - [phase-01-setup-monorepo-environment.md:50-54](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-01-setup-monorepo-environment.md#L50-L54) (Defines flat Docker Compose layout without configuration for healthy dependencies or wait cycles)
  - [phase-06-testing-validation.md:45](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-06-testing-validation.md#L45) (Asserts that `docker-compose up -d` is sufficient to boot all containers successfully without failure mitigation)
- **Suggested fix:** Configure a postgres `healthcheck` in `docker-compose.yml`, set `depends_on` with `condition: service_healthy` for the application containers, and execute a migration wait check script (such as `prisma db push` or waiting for the schema migration table state) before starting the gateway's server process.

---

## Finding 5: Event Loop Blocking and Denial of Service (DoS) via Synchronous Sandboxed Execution
- **Severity:** High
- **Location:** Phase 5, section "Implementation Steps"
- **Flaw:** Dynamic script execution in the QuickJS sandbox runs synchronously on the main Node.js event loop of the Gateway service.
- **Failure scenario:** A client sends concurrent requests that execute dynamic scripts containing infinite loops or heavy CPU instructions (e.g., `while(true){}`). Even though the QuickJS interrupt handler halts execution after 100ms, the execution is entirely synchronous and blocks the single-threaded Node.js event loop. A batch of 50 concurrent malicious requests will freeze the entire gateway for 5 full seconds. During this window, the gateway is unresponsive, cannot accept new client connections, and drops existing requests.
- **Evidence:**
  - [phase-05-sandboxed-scripting.md:40-43](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L40-L43) (Integrates execution step directly into `index.ts` handler logic without threading or process isolation)
  - [phase-05-sandboxed-scripting.md:48](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L48) (Expects loops to "cleanly halt" without recognizing event loop blocking)
- **Suggested fix:** Offload sandboxed QuickJS execution to a pool of Node.js background threads using `worker_threads` or a separate executor microservice. This ensures the main gateway event loop remains responsive to handle HTTP routing and network requests.

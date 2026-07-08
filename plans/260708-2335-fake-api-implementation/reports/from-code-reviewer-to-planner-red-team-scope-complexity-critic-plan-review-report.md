# Red Team Plan Review: Scope & Complexity Critic & Contract Verifier

**Review Date:** 2026-07-08  
**Project:** Fake API Application  
**Assigned Roles:** Scope & Complexity Critic / Contract Verifier  
**Review Status:** CRITICAL REJECTIONS - PLAN REQUIRES RE-WORK  

---

## Finding 1: Technical Factual Error and JVM Terminology in WebAssembly Sandbox
- **Severity:** Critical
- **Location:** Phase 5, section "Requirements"
- **Flaw:** The plan specifies using `quickjs-emscripten` (a C-based QuickJS interpreter compiled to WebAssembly) to evaluate user-submitted scripts, but then mandates a memory limitation of: "JVM heap limits capped at 8MB". QuickJS and Emscripten run natively or inside V8/WASM, and have absolutely no relation to a Java Virtual Machine (JVM). This is a severe factual and conceptual mismatch in the technical requirements.
- **Failure scenario:** The implementation team will fail to find or apply standard Node/JVM flags to a WebAssembly container. Under high load, without a correct memory constraint wrapper configuration specific to the QuickJS Emscripten interface, memory-hungry mock scripts will consume unlimited memory on the Node.js process heap, resulting in Out-Of-Memory (OOM) host crashes that tear down the entire Gateway service.
- **Evidence:** [phase-05-sandboxed-scripting.md:21](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L21): `  - Memory: JVM heap limits capped at 8MB.`
- **Suggested fix:** Remove all references to the JVM. Explicitly define how the QuickJS heap will be constrained using the memory limits configured during `quickjs-emscripten` runtime instantiation (e.g., using `shouldInterrupt` callbacks or QuickJS native heap configuration options).

---

## Finding 2: Severe Over-Engineering: WASM-Sandboxed QuickJS for a Self-Hosted MVP
- **Severity:** High
- **Location:** Phase 5, section "Overview" & "Architecture"
- **Flaw:** The plan calls for executing user script files in an isolated WebAssembly-based JavaScript sandbox to produce mock responses. Since this project is explicitly defined as a "self-hosted" application, the operator hosting the system is the owner who configures the mocks. There is no multi-tenant untrusted user environment. Utilizing WebAssembly sandboxing is unnecessary, introduces substantial execution overhead, and dramatically increases development complexity.
- **Failure scenario:** Serialization and marshaling of the `req` context and the `res` actions across the Node.js and WASM barrier will introduce bugs (such as parsing HTTP headers or handling stream payloads). It will also slow down gateway routing performance from sub-millisecond execution times to tens of milliseconds per request, defeating the goal of a "fast Mock API Gateway."
- **Evidence:** 
  - [phase-05-sandboxed-scripting.md:11-12](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L11-L12): `Integrate quickjs-emscripten within the Gateway to safely evaluate JavaScript code submitted by users. Ensure strict timeout and memory limits...`
  - [phase-05-sandboxed-scripting.md:24-25](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-05-sandboxed-scripting.md#L24-L25): `quickjs-emscripten compiles QuickJS into WebAssembly, running guest code entirely outside the host process namespace.`
- **Suggested fix:** Simplify the architecture for the MVP. Replace the WebAssembly QuickJS sandbox with Node's native `vm` module, or replace JavaScript execution entirely with a declarative JSON-based rules engine for mapping inputs to outputs.

---

## Finding 3: Database Client Interface Drift and Lack of Workspace Schema Sharing
- **Severity:** High
- **Location:** Phase 1, section "Implementation Steps" & Phase 2, section "Implementation Steps" & Phase 4, section "Implementation Steps"
- **Flaw:** The plan specifies initializing Prisma schema inside the Dashboard application and running migrations from there, but then expects the Gateway application to connect to the same database using its own Prisma Client instance. There is no shared npm workspace package or schema-sharing mechanism defined to sync the database schema or client.
- **Failure scenario:** When schemas are modified inside `/apps/dashboard`, the changes will not be reflected automatically in `/apps/gateway`. The Gateway will run queries against stale tables or columns, causing database schema mismatch errors at runtime and crashing client mock calls.
- **Evidence:**
  - [phase-02-database-auth.md:36](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-02-database-auth.md#L36): `1. Initialize Prisma inside /apps/dashboard and specify the database schema (User, Endpoint, ApiLog).`
  - [phase-04-gateway-routing-engine.md:31](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L31): `  - apps/gateway/src/db.ts (Prisma Client instance)`
  - [phase-04-gateway-routing-engine.md:35](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L35): `2. Connect to the shared PostgreSQL database using Prisma Client.`
- **Suggested fix:** Modify the monorepo structure in Phase 1 to include a shared workspace library (e.g., `packages/db` or `packages/prisma`). The Prisma schema and client generation should live there, and both `apps/dashboard` and `apps/gateway` must depend on this package.

---

## Finding 4: Incompatible Routing Contract: Multi-tenant Path Prefixes vs. Realistic Mocking
- **Severity:** High
- **Location:** Phase 4, section "Implementation Steps" & Phase 6, section "Implementation Steps"
- **Flaw:** The plan designs the Mock Gateway to intercept all traffic using a catch-all route, but then states that the gateway will resolve the project context from a path prefix (e.g., `/mock/:projectId/*`). If the route must contain a `/mock/:projectId/` prefix, then the API is not a true transparent fake/mock gateway for standard external URLs. For example, if a user wants to mock a third-party webhook targeting `/v1/charges`, they cannot use `/v1/charges` directly; they are forced to use `/mock/:projectId/v1/charges`. If they try to hit `/v1/charges` directly, the gateway cannot resolve which project owns it.
- **Failure scenario:** The gateway receives an incoming webhook request targeting `/v1/charges`. Because the request does not carry the custom `/mock/:projectId` path segment, the routing engine cannot find the target project config, resulting in a 404 or a routing resolution failure.
- **Evidence:**
  - [phase-04-gateway-routing-engine.md:37](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-04-gateway-routing-engine.md#L37): `4. Extract user identity or project context from prefix path (e.g., /mock/:projectId/*).`
  - [phase-06-testing-validation.md:35](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-06-testing-validation.md#L35): `    - Catch-all fallback (/*) to Gateway (http://gateway:3001).`
- **Suggested fix:** Re-design the routing resolution contract. Instead of path-based project prefixing, extract the project identity using wildcards on subdomains (e.g., `http://:projectId.api-fake.reidev.life/*`) or utilize a request header (e.g., `X-Fake-Project-Id`).

---

## Finding 5: Scope Creep: Unplanned Log Cleanup/Rotation Daemon
- **Severity:** Medium
- **Location:** Phase 6, section "Implementation Steps"
- **Flaw:** The plan casually introduces a requirement in the final phase to validate that a "log rotation/clean-up task runs to prune logs older than 7 days." However, there is absolutely no design, library dependency, container setup, or implementation steps for this task in any of the preceding phases.
- **Failure scenario:** The implementation team will reach Phase 6 and realize they must write an ad-hoc cron daemon, database partition job, or background worker from scratch. This introduces unplanned dependencies (like `node-cron` or `bullmq`) and potential query performance degradation when running database delete operations without designated indexes.
- **Evidence:** [phase-06-testing-validation.md:42](file:///Users/reiz/Data/Workspace/MyProject/api-fake/plans/260708-2335-fake-api-implementation/phase-06-testing-validation.md#L42): `4. Validate that log rotation/clean-up task runs to prune logs older than 7 days.`
- **Suggested fix:** Formally define the log cleanup task as a requirement in Phase 3 or Phase 4, design the database indices to support high-performance bulk deletes on `ApiLog` timestamp columns, or defer log pruning entirely to a post-MVP roadmap item.

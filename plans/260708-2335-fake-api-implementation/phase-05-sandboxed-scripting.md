---
phase: 5
title: Sandboxed Scripting
status: completed
priority: P1
dependencies:
  - 3
  - 4
---

# Phase 5: Sandboxed Scripting

## Overview
Integrate `quickjs-emscripten` inside Node.js background Worker Threads within the Gateway to safely and asynchronously evaluate JavaScript code submitted by users. Ensure strict timeout and memory limits to prevent CPU/memory starvation.

## Requirements
- Functional:
  - User JS scripts executed in background workers to produce mock responses.
  - Expose request objects and response helper objects inside the sandbox.
  - Implement request rate limiting and cap delay configurations to 2,000ms.
- Non-functional:
  - Safe VM isolation using WebAssembly.
  - CPU protection: Script execution timeout capped at 100ms.
  - Memory protection: WASM memory limits capped at 8MB.
  - Asynchronous DB logging to prevent connection pool starvation.

## Architecture
- `quickjs-emscripten` compiles QuickJS into WebAssembly, running guest code entirely outside the host process namespace.
- **Worker Threads:** Offload script execution to background threads using a worker pool (`worker_threads` / `piscina`). This prevents blocking the gateway's main event loop during CPU-intensive operations (e.g. infinite loops).
- **WASM Clean-up:** Enforce manual resource release by disposing of contexts, runtimes, and variables inside `try...finally` blocks.
- **Async DB Logging:** The Gateway writes log events to an in-memory batch buffer and flushes them to PostgreSQL asynchronously to avoid blocking threads or exhausting database connection pools.

## Related Code Files
- Create:
  - `apps/gateway/src/sandbox.ts` (Entrypoint for thread worker)
  - `apps/gateway/src/sandbox.worker.ts` (Worker thread executing QuickJS in WASM)
  - `apps/gateway/src/logger-buffer.ts` (Async log batching queue)
- Modify:
  - `apps/gateway/src/index.ts` (Integrate rate limits, delay check, worker task dispatch, and async log buffer)

## Implementation Steps
1. Install `quickjs-emscripten` in `/apps/gateway`.
2. Configure dynamic route rate-limiting middleware in Fastify/Express (e.g., maximum 60 requests per minute per IP).
3. Implement `apps/gateway/src/sandbox.worker.ts` executing QuickJS inside the worker:
   - Create a clean V8 Isolate context for each call.
   - Inject `req` context (`method`, `headers`, `query`, `body`, `params`).
   - Run the guest JS script.
   - Enforce execution limits: set interrupt handler to abort executing code exceeding 100ms, and configure WASM maximum memory to 8MB.
   - **CRITICAL:** Implement strict resource cleanup:
     ```typescript
     let runtime;
     let context;
     try {
       runtime = await getQuickJS().newRuntime();
       runtime.setMemoryLimit(8 * 1024 * 1024); // 8MB WASM RAM limit
       context = runtime.newContext();
       // ... bind req, execute script ...
     } finally {
       if (context) context.dispose();
       if (runtime) runtime.dispose();
     }
     ```
4. Build `apps/gateway/src/logger-buffer.ts`:
   - Setup an array buffer `apiLogsBuffer: ApiLog[] = []`.
   - Implement an async write handler: `logRequest(apiLogData)`.
   - Setup a `setInterval` running every 2-5 seconds that flushes queued logs to PostgreSQL in a single batch query (`prisma.apiLog.createMany(...)`).
5. Update `index.ts` gateway handlers:
   - Apply rate limiters on `/mock/*` routes.
   - Read endpoint config. Capping request delay at 2000ms max.
   - If a script is defined, dispatch execution to `sandbox.worker.ts` via thread pool, awaiting results asynchronously.
   - Apply delays via `setTimeout` only *after* completing sandbox execution.
   - Push request and response details into the asynchronous log buffer.

## Success Criteria
- [ ] Sandboxed script executes successfully and modifies status codes and headers dynamically.
- [ ] Infinite loops (`while (true) {}`) are cleanly halted within 100ms and DO NOT block the Gateway's main event loop (main thread is fully responsive during execution).
- [ ] Memory leaks are eliminated; heap memory size remains stable after thousands of concurrent runs.
- [ ] Request logs are written in background batches, keeping the PostgreSQL connection pool healthy.
- [ ] Latency delays over 2,000ms are rejected.

## Risk Assessment
- *Host file/network access escape*: Solved by QuickJS WASM containing no system bindings (`fs`, `http`, `child_process`).
- *WASM instance initialization overhead*: Keep worker threads persistent (warmed) to eliminate start up delay.

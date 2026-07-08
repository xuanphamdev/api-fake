---
title: 'Phase 3: DevOps & Telemetry Features'
status: completed
---

# Phase 3: DevOps & Telemetry Features

## Tasks

- [ ] **OpenAPI / Swagger Spec Parser**
  - Implement parsing logic for Swagger/OpenAPI files inside Dashboard Server Actions.
  - Traverse spec paths to auto-create endpoints (methods, paths, default status, empty mock response templates).
  - Add drag-and-drop import modal to Dashboard UI.
  - Files: `apps/dashboard/src/app/actions.ts`

- [ ] **Real-time Webhook Logs Forwarder**
  - Create Project Webhook Target URL field in Dashboard.
  - Implement asynchronous webhook dispatcher inside Gateway (running out-of-band using `fetch` on background processes to avoid blocking mock responses).
  - Files: `apps/gateway/src/index.ts`, `apps/dashboard/src/app/actions.ts`

- [ ] **Telemetry Dashboard Analytics**
  - Add indexing to `ApiLog` timestamp and status code fields.
  - Write Server Actions fetching aggregated statistics (requests count over time, average latency, and status code ratio).
  - Add chart components (using lightweight SVG or charting library) in Dashboard UI.
  - Files: `apps/dashboard/src/app/actions.ts`, `apps/dashboard/src/app/dashboard/projects/[projectSlug]/logs/page.tsx`

## Acceptance Criteria
- Uploading an OpenAPI spec automatically populates endpoints table with corresponding mock routes.
- Webhook targets receive HTTP POST callbacks on every mock request with accurate headers and bodies.
- Analytics tab displays correct request volume trends and latency metrics.

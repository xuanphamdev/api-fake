---
phase: 3
title: Dashboard UI & Logs
status: completed
priority: P2
dependencies:
  - 2
---

# Phase 3: Dashboard UI & Logs

## Overview
Develop the management interface inside the Next.js Dashboard. This allows users to manage Projects, configure mock endpoints within those projects, and inspect logs visually.

## Requirements
- Functional:
  - Manage Projects (CRUD).
  - Create and edit endpoints with custom paths, methods, status codes, headers, and scripts, nested under selected Projects.
  - Render details of all requests intercepted by the Mock Gateway (headers, payload, duration, status).
- Non-functional:
  - Clean, responsive dashboard layout using Tailwind CSS.
  - Strict IDOR verification on all UI queries and APIs.

## Architecture
- React Client Components interact with Next.js Server Actions or APIs to manage DB records.
- Monaco Editor or standard text areas are integrated for writing dynamic scripts.
- Every API endpoint and DB query strictly filters by `userId` from the authenticated session.

## Related Code Files
- Create:
  - `apps/dashboard/src/app/dashboard/layout.tsx` (Sidebar & Navigation)
  - `apps/dashboard/src/app/dashboard/projects/page.tsx` (Project selector/list)
  - `apps/dashboard/src/app/dashboard/projects/new/page.tsx` (Create project form)
  - `apps/dashboard/src/app/dashboard/projects/[projectSlug]/endpoints/page.tsx` (List view of endpoints)
  - `apps/dashboard/src/app/dashboard/projects/[projectSlug]/endpoints/new/page.tsx` (Creation form)
  - `apps/dashboard/src/app/dashboard/projects/[projectSlug]/endpoints/[id]/page.tsx` (Edit form)
  - `apps/dashboard/src/app/dashboard/projects/[projectSlug]/logs/page.tsx` (Log list)

## Implementation Steps
1. Build Sidebar layout, project selector, navigation, and user status indicators.
2. Build Project management pages (list, creation form with slug validation).
3. Enforce auth verification on all CRUD routes:
   - For any action on a project, check `where: { id: projectId, userId: session.userId }`.
   - For any action on an endpoint, check `where: { id: endpointId, project: { userId: session.userId } }`.
4. Build the Endpoint create/edit page nested under the project:
   - Method dropdown (GET, POST, PUT, DELETE, etc.).
   - Path string input.
   - Status code input (default 200).
   - Delay slider (capped at 2000ms max to prevent socket exhaustion).
   - Dynamic Scripting block (JavaScript script editor).
5. Build Request Log list with sorting by time, path searches, and pagination.
6. Build a modal view showing raw Request/Response bodies, headers, and duration.

## Success Criteria
- [ ] User can fully manage projects and endpoints through the dashboard.
- [ ] Access control prevents users from viewing, editing, or deleting projects/endpoints/logs belonging to other accounts (IDOR test passes).
- [ ] UI restricts delay configurations to a maximum of 2,000ms.

## Risk Assessment
- *IDOR vulnerability*: Solved by never relying on client-provided `userId` inputs; always query through user relationship chains locked to the authenticated session context.


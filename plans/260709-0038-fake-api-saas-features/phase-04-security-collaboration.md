---
title: 'Phase 4: Security & Team Collaboration'
status: completed
---

# Phase 4: Security & Team Collaboration

## Tasks

- [ ] **Project Access Sharing (RBAC)**
  - Build Collaborator management panel in Project settings (invite by email, set role as Read or Write).
  - Update all Dashboard Server Actions to verify access by checking `ProjectCollaborator` records alongside project `userId` owners.
  - Files: `apps/dashboard/src/app/actions.ts`

- [ ] **Mock API Keys Gatekeeping**
  - Implement API Key generation (generating random hash tokens stored in database).
  - Add "Enforce API Key Authentication" toggle to Project Settings.
  - Update Gateway matcher middleware to verify the `Authorization: Bearer <key>` header against the database before serving any mock routes if toggle is enabled.
  - Files: `apps/gateway/src/index.ts`, `apps/dashboard/src/app/actions.ts`

## Acceptance Criteria
- Secondary user accounts invited to projects can access and manage endpoints depending on their invited role.
- Uninvited users cannot access or view project details (preventing IDOR).
- Mock routes with API Key protection enabled return `401 Unauthorized` unless a valid Bearer key header is supplied.

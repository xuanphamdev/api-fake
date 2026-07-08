---
title: 'Phase 1: Setup & Schema Migrations'
status: completed
---

# Phase 1: Setup & Schema Migrations

## Tasks

- [ ] **Extend Prisma Schema**
  - Add `ProjectSecret` model (`id`, `key`, `encryptedValue`, `projectId`).
  - Add `ProjectCollaborator` model (`id`, `email`, `role`, `projectId`).
  - Add `ApiKey` model (`id`, `key`, `name`, `projectId`).
  - Modify `Project` model to support `secrets`, `collaborators`, and `apiKeys` relationships.
  - File: `packages/db/prisma/schema.prisma`

- [ ] **Execute Migrations**
  - Run database migration command: `npx prisma migrate dev --name add_saas_features --schema=packages/db/prisma/schema.prisma`
  - Re-generate Prisma Client inside the package.

- [ ] **Export Client Methods**
  - Rebuild `packages/db` package to propagate new model types and interfaces.
  - File: `packages/db/src/index.ts`

## Acceptance Criteria
- Database migrations execute cleanly without data loss.
- `npm run build:db` compiles without errors and outputs correct Prisma client typings.

---
phase: 2
title: Database & Auth
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Database & Auth

## Overview
Set up the Prisma ORM schema inside the shared database package, configure user registration/login inside the Next.js app, and secure the dashboard routes with session authentication.

## Requirements
- Functional:
  - Users can register and log in to the Dashboard.
  - JWT or Session-based auth cookies prevent unauthorized access.
  - Support multi-project isolation for mock endpoints.
- Non-functional:
  - Type-safe database client (Prisma) shared across packages.
  - Secure password hashing using bcrypt.

## Architecture
- PostgreSQL acts as the single source of truth for users, projects, endpoints, and logs.
- Schema defines `User` -> has many `Project` -> has many `Endpoint` -> has many `ApiLog`.
- `Project` contains a unique URL `slug` to safely identify mock routes without exposing internal DB IDs.

## Related Code Files
- Create:
  - `packages/db/prisma/schema.prisma`
  - `apps/dashboard/src/app/api/auth/register/route.ts`
  - `apps/dashboard/src/app/api/auth/login/route.ts`
  - `apps/dashboard/src/app/api/auth/logout/route.ts`
  - `apps/dashboard/src/lib/auth.ts` (JWT/cookie helper)
  - `apps/dashboard/src/middleware.ts` (Auth protection middleware)

## Implementation Steps
1. Initialize Prisma inside `/packages/db` and specify the database schema:
   ```prisma
   model User {
     id        String    @id @default(uuid())
     email     String    @unique
     password  String
     projects  Project[]
     createdAt DateTime  @default(now())
   }

   model Project {
     id        String     @id @default(uuid())
     name      String
     slug      String     @unique
     userId    String
     user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
     endpoints Endpoint[]
     createdAt DateTime   @default(now())
   }

   model Endpoint {
     id           String    @id @default(uuid())
     path         String
     method       String
     headers      Json?
     statusCode   Int       @default(200)
     responseBody String?
     delay        Int       @default(0)
     script       String?
     projectId    String
     project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
     logs         ApiLog[]
     createdAt    DateTime  @default(now())
     updatedAt    DateTime  @updatedAt

     @@unique([projectId, path, method])
   }

   model ApiLog {
     id          String    @id @default(uuid())
     endpointId  String
     endpoint    Endpoint  @relation(fields: [endpointId], references: [id], onDelete: Cascade)
     method      String
     path        String
     reqHeaders  Json
     reqQuery    Json
     reqBody     Json?
     resHeaders  Json
     resStatus   Int
     resBody     String?
     duration    Int
     timestamp   DateTime  @default(now())
   }
   ```
2. Run database migrations to provision tables in the local PostgreSQL instance.
3. Export Prisma Client from the `packages/db` workspace so both apps compile against it.
4. Implement password hashing using `bcryptjs` and session-token signing inside the dashboard.
5. Create Next.js API routes for registration, login, and logout.
6. Create Next.js middleware to check session cookies and protect `/dashboard/*` paths.

## Success Criteria
- [ ] Prisma schemas are migrated successfully into PostgreSQL.
- [ ] Workspace package `packages/db` generates client types available to both services.
- [ ] API routes for registration and login function correctly with proper validation.
- [ ] Unauthorized users are redirected away from `/dashboard`.

## Risk Assessment
- *Plain-text password exposure*: Handled by hashing passwords immediately on receipt with bcryptjs using 10 salt rounds.

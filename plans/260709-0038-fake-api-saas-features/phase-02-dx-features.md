---
title: 'Phase 2: Developer Experience (DX) Features'
status: completed
---

# Phase 2: Developer Experience (DX) Features

## Tasks

- [ ] **Custom CORS Panel**
  - Add CORS configuration fields (origins, headers, methods, credentials) in Dashboard.
  - Implement Caddy or Express CORS preflight handler querying project configurations dynamically.
  - Files: `apps/dashboard/src/app/actions.ts`, `apps/gateway/src/index.ts`

- [ ] **Environment Secrets (req.env)**
  - Build UI for Project Secrets manager (encrypting input values with a server-side secret key before db write).
  - Fetch and inject decrypted secrets into QuickJS worker context initialization payload.
  - Expose as global `req.env` object inside the VM sandbox.
  - Files: `apps/dashboard/src/app/actions.ts`, `apps/gateway/src/index.ts`, `apps/gateway/src/sandbox.worker.ts`

- [ ] **JWT & Crypto Sandbox Signer**
  - Inject a lightweight JS crypto library (like minimal `jsrsasign` or custom hmac wrapper) into the sandbox runtime context prefix.
  - Expose helper object `res.jwt.sign(payload, secret)` and `res.jwt.verify(token, secret)` inside the VM sandbox.
  - File: `apps/gateway/src/sandbox.worker.ts`

## Acceptance Criteria
- User can configure environment secrets and CORS rules in the Dashboard UI.
- Sandboxed JS scripts can successfully execute `res.send({ key: req.env.MY_SECRET })` returning decrypted values.
- Sandboxed JS scripts can sign JSON payloads to produce valid HS256 JWT tokens.
- CORS requests from custom origins receive correct response headers.

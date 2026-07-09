# Deployment

## Platform
Self-hosted Docker Compose on VPS `104.248.149.227` (Ubuntu 16.04, Docker 28 + Compose v2).
Accessed directly via host port **9090** (host :80/:443 belong to another service).

## Public URLs
- Dashboard: `http://104.248.149.227:9090/dashboard`
- Mock endpoints: `http://104.248.149.227:9090/mock/:projectSlug/*`

## Architecture
```
Internet → :9090 → api-fake-proxy (Caddy) → dashboard:3000  (/dashboard*)
                                           → gateway:3001    (/*)
                                           → db (internal only)
```
- `docker-compose.prod.yml` (in repo): shared-server compose. DB/app ports internal only; Caddy on `127.0.0.1:8090`.
- `docker-compose.server.yml` (on server only, host-specific): publishes Caddy on `0.0.0.0:9090` for direct IP access.

## Location on server
`/root/api-fake` — git clone of `develop`. Secrets in `/root/api-fake/.env` (chmod 600, not committed).

## Deploy / update
```bash
cd /root/api-fake
git fetch origin develop && git reset --hard origin/develop
docker compose -f docker-compose.prod.yml -f docker-compose.server.yml up -d --build
```
The one-shot `migrate` service runs `prisma migrate deploy` before app services start.

## Environment variables (server `.env`)
| Var | Notes |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | DB credentials |
| `DATABASE_URL` | Must match the above; host is `db` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Exactly 32 chars. **Must match** across dashboard + gateway. Changing it makes stored secrets undecryptable. |

## Optional: custom domain + HTTPS
The host runs Nginx Proxy Manager (`http://104.248.149.227:81`). To put a domain
with TLS in front, add a Proxy Host forwarding to `127.0.0.1:9090` (or attach Caddy
to the `nginxproxymanager_default` network and forward to `api-fake-proxy:80`),
then request a Let's Encrypt cert + Force SSL.

## Verify
```bash
curl -sL -o /dev/null -w "%{http_code}\n" http://104.248.149.227:9090/dashboard   # 200 after redirect
docker compose -f docker-compose.prod.yml -f docker-compose.server.yml ps
```

## Rollback
```bash
cd /root/api-fake
git reset --hard <previous-commit>
docker compose -f docker-compose.prod.yml -f docker-compose.server.yml up -d --build
```
DB data persists in the `pgdata` volume across redeploys.

## Notes
- Previous failed attempt preserved at `/root/api-fake.prev-*` (safe to delete).

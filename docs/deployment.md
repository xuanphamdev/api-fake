# Deployment

## Platform
Self-hosted Docker Compose on VPS `104.248.149.227` (Ubuntu 16.04, Docker 28 + Compose v2).
The host already runs **Nginx Proxy Manager (NPM)** which owns ports 80/443 and terminates TLS.

## Architecture
```
Internet → NPM (:80/:443, TLS) → api-fake-proxy (Caddy, :80) → dashboard:3000 / gateway:3001
                                                              → db (internal only)
```
- `docker-compose.prod.yml` (in repo): shared-server compose. DB/app ports internal only; Caddy published on `127.0.0.1:8090`.
- `docker-compose.npm.yml` (on server only, host-specific): attaches Caddy to the external `nginxproxymanager_default` network so NPM forwards by container name.

## Location on server
`/root/api-fake` — git clone of `develop`. Secrets in `/root/api-fake/.env` (chmod 600, not committed).

## Deploy / update
```bash
cd /root/api-fake
git fetch origin develop && git reset --hard origin/develop
docker compose -f docker-compose.prod.yml -f docker-compose.npm.yml up -d --build
```
The one-shot `migrate` service runs `prisma migrate deploy` before app services start.

## Environment variables (server `.env`)
| Var | Notes |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | DB credentials |
| `DATABASE_URL` | Must match the above; host is `db` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Exactly 32 chars. **Must match** across dashboard + gateway. Changing it makes stored secrets undecryptable. |

## Public routing (Nginx Proxy Manager)
Add a Proxy Host in the NPM UI (`http://104.248.149.227:81`):
- Domain: `<your-domain>` (DNS A record → 104.248.149.227)
- Scheme: `http`, Forward host: `api-fake-proxy`, Forward port: `80`
- Block common exploits: on; Websockets: on
- SSL tab: request a new Let's Encrypt certificate, Force SSL

Dashboard: `https://<domain>/dashboard` · Mock endpoints: `https://<domain>/mock/:projectSlug/*`

## Verify
```bash
curl -sL -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8090/dashboard   # 200 after redirect
docker compose -f docker-compose.prod.yml ps
```

## Rollback
```bash
cd /root/api-fake
git reset --hard <previous-commit>
docker compose -f docker-compose.prod.yml -f docker-compose.npm.yml up -d --build
```
DB data persists in the `pgdata` volume across redeploys.

## Notes
- Previous failed attempt preserved at `/root/api-fake.prev-*` (safe to delete).

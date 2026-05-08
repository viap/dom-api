# DOM API Local Development

## Local source of truth

- Backend app: `/Users/mr.blood/Projects/DOM/dom-api`
- Paired frontend app: `/Users/mr.blood/Projects/DOM/dom-web`
- Backend HTTP port: `3003`
- Backend WebSocket port: `3004`
- Primary env file: `config/.env`

## Recommended backend env baseline

Use `dom-api/config/.env` for local development.

Baseline local values:

```env
NODE_ENV=dev
PORT=3003
WEBSOCKET_PORT=3004
CORS_ORIGINS=http://localhost:3006

JWT_SECRET=your-strong-jwt-secret-key-min-32-chars-abcdef123456789
BOT_CLIENT_NAME=domBot
BOT_CLIENT_PASSWORD=Knock-Knock-Bot
WEB_CLIENT_NAME=domWeb
WEB_CLIENT_PASSWORD=Knock-Knock-Web

MONGO_URL=mongodb://localhost:27017
MONGO_DBNAME=domData
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=example
```

Notes:

- `CORS_ORIGINS` supports a comma-separated allowlist.
- Each allowlist value must be an exact origin in the format `scheme://host:port`.
- Do not include paths (e.g. `/ru/login`) or trailing slashes.
- Multi-origin example: `CORS_ORIGINS=http://localhost:3006,https://dom.example.com`
- Empty/missing `CORS_ORIGINS` falls back to `http://localhost:3006`.
- Keep real production/staging secrets out of local env files.

## Startup steps

1. In `/Users/mr.blood/Projects/DOM/dom-api`, install dependencies with `npm install`.
2. Ensure MongoDB is reachable with values from `config/.env`.
3. Start the API with `npm run start:dev`.
4. Verify health endpoint at `http://localhost:3003/auth/ping`.

## Common development commands

```bash
# Run backend in watch mode
npm run start:dev

# Build and run production build locally
npm run build
npm run start:prod

# Quality checks
npm run lint
npm run test
npm run test:e2e
npm run test:cov
```

## Common local pitfalls and quick checks

- API not reachable:
  - confirm `PORT` and startup logs
  - hit `GET /auth/ping`
- Mongo connection errors:
  - verify local Mongo process
  - verify `MONGO_URL`, `MONGO_DBNAME`, and credentials
- CORS issues from frontend:
  - confirm `CORS_ORIGINS` includes `http://localhost:3006`
  - if deployed frontend uses IP/domain origin, include that exact origin with scheme and port
- Missing uploaded media in local verification:
  - ensure clients use media endpoints (`/media/:id/content`, `/media/:id/thumbnail`), not raw `/uploads/...` paths

## Production Auth Triage Checklist (`401`/`429`)

1. Verify API health:
   - `curl -i http://<api-host>:3003/auth/ping`
   - expected: `200` + `pong`
2. Verify startup auth env validation passed:
   - ensure `JWT_SECRET`, `BOT_CLIENT_*`, `WEB_CLIENT_*` are present on process env
3. Verify trusted-proxy IP resolution assumptions:
   - API must be behind one trusted reverse proxy hop (`trust proxy = 1`)
   - direct public access to API should be blocked so clients cannot bypass proxy IP resolution
4. Run two probes with distinct `X-Request-Id`:
   - valid `apiClient` + bad user password
   - invalid `apiClient`
5. Inspect structured logs:
   - `pm2 logs domApi --lines 200 --nostream | grep auth.login.failure`
   - expected reasons: `invalid_user_credentials` and `invalid_api_client`
6. Check lockout:
   - the 5th bad attempt records lockout for same IP+login in a 15-minute window
   - the 6th and later attempts are blocked for 15 minutes

Expected outcomes:

- External client receives generic `401 Unauthorized` for invalid credentials/client.
- During lockout, external client receives `429 Too Many Requests` with `Retry-After` header and `retryAfterSeconds` in response body.
- Internal logs include request correlation id, reason, source IP, login fingerprint, and lockout marker.

## Post-Deploy Auth Smoke Tests

Run after each deployment/restart:

```bash
PORT=3003

# Health check
curl -sS "http://localhost:${PORT}/auth/ping"

# Probe valid apiClient + bad user creds
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:${PORT}/auth/login/user" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: smoke-valid-client-bad-user" \
  --data '{"apiClient":{"name":"domWeb","password":"<WEB_CLIENT_PASSWORD>"},"user":{"login":"__probe__","password":"__probe__"}}'

# Probe invalid apiClient
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:${PORT}/auth/login/user" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: smoke-invalid-client" \
  --data '{"apiClient":{"name":"domWeb","password":"__bad__"},"user":{"login":"__probe__","password":"__probe__"}}'

# Probe Telegram auth lockout branch shape (repeat to trigger lockout)
curl -i -X POST "http://localhost:${PORT}/auth/login/telegram" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: smoke-telegram-lockout" \
  --data '{"apiClient":{"name":"domWeb","password":"__bad__"},"telegram":{"id":"__probe_telegram__","username":"probe"}}'

# Expect lockout response body shape:
# { "message": "Too many failed attempts", "retryAfterSeconds": <seconds> }
# and Retry-After header in matching seconds.

# Verify internal classification logs
pm2 logs domApi --lines 200 --nostream | grep auth.login.failure
```

BFF request-shape enforcement check (`dom-web`):

```bash
WEB_URL="http://localhost:3006"

# Unknown field must be rejected by BFF with 400
curl -i -X POST "${WEB_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  --data '{"login":"probe","password":"probe","extra":"blocked"}'
```

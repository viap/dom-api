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
- Missing uploaded media in local verification:
  - ensure clients use media endpoints (`/media/:id/content`, `/media/:id/thumbnail`), not raw `/uploads/...` paths

# DOM API Working Context

Use this file first when resuming `dom-api` work. It is the compact backend handoff for current architecture, active constraints, and contract expectations for `dom-web`.

## Project Snapshot

- Backend repo: `/Users/mr.blood/Projects/DOM/dom-api`
- Paired frontend repo: `/Users/mr.blood/Projects/DOM/dom-web`
- Backend local URL: `http://localhost:3003`
- Backend WebSocket port: `3004`
- Frontend local URL (consumer): `http://localhost:3006`
- Local setup source of truth: [specs/local-development.md](./specs/local-development.md)

## Current Architecture

- Stack: NestJS 10, TypeScript, MongoDB/Mongoose, Joi validation, Socket.IO.
- Global app setup in `src/app.module.ts`:
  - global auth and role guards (`AuthGuard`, `RolesGuard`)
  - global interceptors (`UserContextInterceptor`, `TimezoneInterceptor`)
  - global sanitization middleware for all routes
  - global throttling (`ttl=60000`, `limit=100`)
- CORS and static file behavior in `src/main.ts`:
  - CORS allowlist from `CORS_ORIGINS` (fallback `http://localhost:3006`)
  - raw `/uploads/media` and `/uploads/thumbnails` access is blocked (`404`)
  - media delivery must go through media controller endpoints

## Current Product Areas and Route/Auth Realities

- Core modules remain active: `auth`, `users`, `roles`, `psychologists`, `therapy-sessions`, `therapy-requests`, `notifications`, `ws`, `api-clients`, and `booking-system/*`.
- Content/CMS modules are active: `domains`, `menus`, `pages`, `media`, `applications`, `events`, `locations`, `partners`, `people`, `programs`.
- Role model in use for app consumers: `Admin`, `Editor`, and authenticated user flows.
- Frontend-facing contract references:
  - [ADMIN-WEB-API.md](./ADMIN-WEB-API.md)
  - [ADMIN-API-EXAMPLES.md](./ADMIN-API-EXAMPLES.md)
  - [ROUTE-PERMISSIONS-MATRIX.md](./ROUTE-PERMISSIONS-MATRIX.md)
  - [PAGE-BLOCKS-SPEC.md](./PAGE-BLOCKS-SPEC.md)

## Known Constraints and Source-of-Truth Precedence

If docs and code disagree, use this precedence:

`controller/service code > Joi schema > Mongoose schema > docs`

Additional constraints to keep in mind:

- Public media delivery is intentionally restricted to media controller endpoints; clients must not rely on raw `/uploads/...` URLs.
- Page block behavior is backend-driven; frontend editor behavior must stay aligned with backend Joi/page schemas.
- Route authorization is guard-driven and role-checked globally; use the permissions matrix for route-by-route expectations.

## Resume-Work Checklist

Read these first:

1. `/Users/mr.blood/Projects/DOM/dom-api/src/app.module.ts`
2. `/Users/mr.blood/Projects/DOM/dom-api/src/main.ts`
3. `/Users/mr.blood/Projects/DOM/dom-api/docs/ADMIN-WEB-API.md`
4. `/Users/mr.blood/Projects/DOM/dom-api/docs/ROUTE-PERMISSIONS-MATRIX.md`
5. `/Users/mr.blood/Projects/DOM/dom-api/docs/PAGE-BLOCKS-SPEC.md`

Verification commands:

- `npm run lint`
- `npm run test`
- `npm run test:e2e`

## Backend-to-Frontend Contract Notes (`dom-web`)

- `dom-web` depends on backend API docs in this folder for content/admin flows; keep those docs updated when routes or payloads change.
- For CMS/public routing behavior, backend pages/menus/media contracts are authoritative and should be versioned through active docs before frontend changes are considered complete.
- When changing access semantics (public/auth/admin) for existing routes, update both:
  - [ROUTE-PERMISSIONS-MATRIX.md](./ROUTE-PERMISSIONS-MATRIX.md)
  - [ADMIN-WEB-API.md](./ADMIN-WEB-API.md)

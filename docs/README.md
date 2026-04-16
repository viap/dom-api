# Documentation

Current documentation for `dom-api` lives here. Use the docs below as the active handoff surface for backend setup, current architecture, and API contract references.

## Start Here

### [working-context.md](./working-context.md)
Compact current-state handoff for the backend.

Use it for:
- architecture/module snapshot
- current product areas and route/auth realities
- source-of-truth precedence and known constraints
- resume-work checklist for backend and frontend contract work

### [specs/local-development.md](./specs/local-development.md)
Local environment and startup baseline for `dom-api`.

Use it for:
- local ports and env values
- backend startup and health-check steps
- common local troubleshooting checks

## Active References

- [working-context.md](./working-context.md)
- [specs/local-development.md](./specs/local-development.md)
- [ADMIN-WEB-API.md](./ADMIN-WEB-API.md)
- [ADMIN-API-EXAMPLES.md](./ADMIN-API-EXAMPLES.md)
- [ROUTE-PERMISSIONS-MATRIX.md](./ROUTE-PERMISSIONS-MATRIX.md)
- [AUTH-API.md](./AUTH-API.md)
- [BOOKING-SYSTEM-API.md](./BOOKING-SYSTEM-API.md)
- [PAGE-BLOCKS-SPEC.md](./PAGE-BLOCKS-SPEC.md)
- [ADMIN-UI-SPEC.md](./ADMIN-UI-SPEC.md)
- [RELEASE-NOTES.md](./RELEASE-NOTES.md)

## Legacy / Historical Docs

Historical planning, audits, and one-off review notes live under `docs/archive/`.

- `docs/archive/legacy/` contains non-active docs kept for repository history.
- Archived docs are not the primary source of truth for current backend behavior.

## Documentation Maintenance Rule

After backend changes, update docs before closing the task:

- Update `working-context.md` when architecture, active routes, auth behavior, or known constraints change.
- Update `specs/local-development.md` when local setup/env/startup behavior changes.
- Update API/spec references only for implemented contract changes.
- Move superseded planning/status notes to `docs/archive/legacy/` instead of mixing them into active docs.

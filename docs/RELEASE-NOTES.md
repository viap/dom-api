# Release Notes

## 2026-04-22

- `applications` now support fallback domain resolution by `formType` when `domainId` is omitted.
- `POST /applications`: `domainId` is now optional (resolved from mapped domain code).
- `PATCH /applications/:id`: `domainId` is optional; existing domain is kept when present, fallback mapping applies only for records without `domainId`.

## 2026-04-20

- Breaking change: `SocialNetworks` value changed from `watsapp` to `whatsapp`.
- API payloads still using `watsapp` now fail validation.
- No backward-compatibility alias is provided in this release.

## 2026-04-14

- `pages` now support homepage designation via `isHomepage`.
- New public homepage routes:
  - `GET /pages/global/home`
  - `GET /pages/domain/:domainSlug/home`
- Homepage rules:
  - only published pages can be marked as homepage,
  - only one global homepage is allowed,
  - only one homepage per domain is allowed.

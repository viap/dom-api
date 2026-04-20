# Release Notes

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

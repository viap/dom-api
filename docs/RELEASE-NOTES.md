# Release Notes

## 2026-04-14

- `pages` now support homepage designation via `isHomepage`.
- New public homepage routes:
  - `GET /pages/global/home`
  - `GET /pages/domain/:domainSlug/home`
- Homepage rules:
  - only published pages can be marked as homepage,
  - only one global homepage is allowed,
  - only one homepage per domain is allowed.

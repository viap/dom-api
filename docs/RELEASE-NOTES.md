# Release Notes

## 2026-05-23

- `pages` now include `isTitleVisible` with default `true`.
- `POST /pages` now defaults `isTitleVisible=true` when omitted.
- `PATCH /pages/:id` accepts optional `isTitleVisible` as a partial update field.
- Added one-time migration script:
  - `node scripts/migrate_23052026_pages_isTitleVisible.js`
  - backfills missing `pages.isTitleVisible` to `true`
- API responses temporarily keep a compatibility fallback and return `isTitleVisible: true` when legacy documents still miss the field.

## 2026-05-18

- `DELETE /media/:id` now uses MongoDB transactions to atomically clean up references across Pages (block media refs), Events (`mediaId`), People (`photoId`), and Partners (`logoId`).
- `GET /media/admin` now supports `isPublished` boolean query filter for filtering by published/unpublished status.
- New sparse indexes added on `Events.mediaId`, `People.photoId`, `Partners.logoId`, and `Pages.blocks[].media.mediaId` / `blocks[].backgroundMedia.mediaId` / `blocks[].items[].mediaId`.
- MediaModule refactored to use string injection tokens (`PAGES_CLEANUP`, `EVENTS_CLEANUP`, `PEOPLE_CLEANUP`, `PARTNERS_CLEANUP`) with `MediaReferenceCleanup` interface and `forwardRef()` for circular dependency resolution.
- Each owning service (`PagesService`, `EventsService`, `PeopleService`, `PartnersService`) now implements `cleanupMediaReferences(mediaId, session)`.

## 2026-05-17

- `partners` now require `slug` on create payloads.
- Added new public read route: `GET /partners/slug/:slug`.
- `partners` id read/write routes now accept ObjectId-form IDs only.
- Added migration script:
  - `node scripts/migrate_17052026_partners_slug.js`
  - backfills missing/invalid partner slugs
  - resolves duplicate slugs with deterministic numeric suffixes
- Partners slug uniqueness is enforced globally in the `partners` collection.

## 2026-05-12

- `people` now supports `languages` with canonical values: `ru`, `en`, `ka`.
- `POST /people` defaults `languages` to `['ru']` when omitted.
- `POST /people` and `PATCH /people/:id` now validate `languages` as a non-empty unique array when provided.
- Added one-time migration script:
  - `node scripts/migrate_12052026_people_languages.js`
  - backfills missing/empty `languages` to `['ru']`
  - maps legacy aliases `eng -> en`, `ge -> ka`
  - removes unknown values and deduplicates entries.

## 2026-05-05

- New public bulk-read routes were added for content collections:
  - `POST /domains/bulk`
  - `POST /media/bulk`
  - `POST /pages/bulk`
  - `POST /people/bulk`
  - `POST /partners/bulk`
  - `POST /programs/bulk`
  - `POST /events/bulk`
- Bulk route contract:
  - request: `{ ids: string[] }` (max 100)
  - response: `{ items: T[] }`
- Bulk reads omit unresolved ids from public responses (invalid, missing, unpublished, inactive, and draft-filtered ids are excluded from `items`).
- Public domain reads were tightened to active-only semantics:
  - `GET /domains/:id`
  - `POST /domains/bulk`
- Public bulk routes are throttled at `120 requests / 60 seconds` per IP.
- Programs public reads allow only: `upcoming`, `active`, `completed`, `cancelled`.
- Events public reads allow only: `planned`, `registration_open`, `ongoing`, `completed`, `cancelled`.
- Public page reference resolving in `dom-web` now uses bulk routes to reduce request fan-out.

## 2026-05-04

- Breaking change (`menus`): `domainId` has been removed from menu payloads and storage.
- Breaking change (`menus`): `GET /menus/domain/:domainSlug/:key` has been removed.
- New menu lookup routes:
  - `GET /menus/public/page/:pageId` (public)
  - `GET /menus/page/:pageId` (admin/editor)
- `menus` now support optional `pageId` with global one-menu-per-page uniqueness.
- `menus.key` and `menus.title` are now optional.

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

# Admin UI Spec

This document is a UI-oriented companion to:

- `docs/ADMIN-WEB-API.md`
- `docs/AUTH-API.md`
- `docs/BOOKING-SYSTEM-API.md`
- `docs/ROUTE-PERMISSIONS-MATRIX.md`
- `docs/ADMIN-API-EXAMPLES.md`
- `docs/PAGE-BLOCKS-SPEC.md`

Its purpose is to help frontend development for the admin panel by describing:

- admin sections
- list screens
- create/edit forms
- filters
- actions
- permission expectations

It reflects the API as currently implemented.

---

## 1. Admin Navigation

Recommended top-level admin sections:

### Content

- Domains
- Pages
- Menus
- Media
- Locations
- People
- Partners
- Programs
- Events

### Intake

- Applications

### Operations

- Users
- Notifications
- Therapy Requests
- Therapy Sessions
- Booking System

---

## 2. Shared UI Rules

### Authentication

Admin UI requires JWT auth for all admin-only routes.

### Roles

Recommended frontend assumptions:

- `admin`: full access to all admin pages
- `editor`: full access to content and applications
- `psychologist`: access only to psychologist-specific operational areas

### Common list behavior

For new content modules, use:

- table or card list
- search/filter bar
- pagination using `limit` and `offset`
- create button on pages where writes are allowed

### Common form behavior

Use a create/edit drawer or dedicated page with:

- validation shown inline
- save/cancel actions
- server error block
- read-only metadata block for:
  - `_id`
  - `createdAt`
  - `updatedAt`
  - `schemaVersion`

---

## 3. Content Section

## 3.1 Pages

### Purpose

Manage pages and their embedded content blocks.

### Read routes used by admin UI

- use `GET /pages/admin/:id` for raw page editing
- use `GET /pages/admin/global` for raw global page listing, including drafts
- public page routes stay useful for preview behavior, but not as the source of truth for editing

### Current form fields

- `domainId`
  UI: domain select or empty for global page
- `slug`
  UI: text input
- `title`
  UI: text input
- `status`
  UI: select
  Options:
  - `draft`
  - `published`
- `isHomepage`
  UI: switch
  Rules:
  - allowed only when `status = published`
  - one global homepage max (when `domainId` is empty)
  - one homepage per selected domain
- `seo`
  UI: key/value editor or JSON textarea
- `blocks[]`
  UI: ordered block editor
  Source of truth:
  - `docs/PAGE-BLOCKS-SPEC.md`

### v1 block-editor note

Supported v1 blocks:

- `richText`
- `entityCollection`
- `hero`
- `cta`
- `gallery`
- `applicationForm`

For `richText`, support a lightweight related-people group:

- `title`
  Example: `Authors`
- `peopleIds`
  UI: ordered people multiselect
- `display`
  Options:
  - `inline`
  - `chips`
  - `list`

Recommended preview:

- `Authors: Alice Smith, John Doe`

Other page-editor notes:

- `PATCH /pages/:id` replaces the full `blocks[]` array only when `blocks` is included in the payload
- `entityCollection` is manual-only in v1
- `richText.description` is sanitized HTML
- when homepage constraints fail, backend returns `409`
- setting `isHomepage=true` on draft pages is rejected with `400`

### Permissions

- create/edit/delete: `admin`, `editor`
- public page reads remain published-only

---

## 3.2 Domains

### Purpose

Manage the top-level domain taxonomy.

### List view

Columns:

- Title
- Code
- Slug
- Active
- Order

Actions:

- create
- edit
- delete

### Filters

Minimal:

- search by title/slug client-side or future backend filter
- active/inactive toggle client-side if data volume is small

### Form fields

- `code`
  UI: select
  Options:
  - `psych_center`
  - `community`
  - `academy`
  - `psych_school`
- `title`
  UI: text input
- `slug`
  UI: text input
- `isActive`
  UI: switch
- `order`
  UI: number input
- `seo`
  UI: key/value editor or simple JSON textarea for now

### Permissions

- list/details: public API, but admin UI still loads with auth
- create/edit/delete: `admin`

---

## 3.3 Media

### Purpose

Asset registry used by people, partners, and page blocks, with direct admin upload support.

### List view

Columns:

- Preview
- Title
- Kind
- URL
- Published
- Created

Actions:

- upload
- create
- edit
- delete
- copy URL
- copy ID

### Filters

- kind
- name/title search
- created date range

Selection behavior:

- page-block media picker is modal-based and single-select
- picker supports `search` and `kind` filters
- upload belongs to the dedicated media admin screen, not the page-block picker

### Form fields

- `file`
  UI: file input in upload flow
- `kind`
  UI: select
- `storageKey`
  UI: read-only text for uploaded media, hidden or omitted for external create flow
- `url`
  UI: read-only text for uploaded media, editable only for external media mode
- `title`
  UI: text input
- `mimeType`
  UI: read-only text for uploaded media
- `sizeBytes`
  UI: read-only text/number for uploaded media
- `alt`
  UI: textarea
- `width`
  UI: read-only text/number for uploaded media
- `height`
  UI: read-only text/number for uploaded media
- `isPublished`
  UI: switch

### Permissions

- list/item public in API, but admin management requires `admin` or `editor`

### Notes

- Upload uses the backend `POST /media/upload` endpoint and stores images on server disk.
- Uploaded files are rendered only from the returned `url` field or `GET /media/:id/content`.
- `POST /media` is for external media only and should not expose local-storage fields in the form.
- Public media routes still expose published records only.
- Page-block media picker should expose published media only.

---

## 3.4 Locations

### Purpose

Reusable venue/address records, mainly for events.

### List view

Columns:

- Title
- Address
- City
- Country
- Updated At

Actions:

- create
- edit
- delete
- copy ID

### Filters

- title
- city

### Form fields

- `title`
  UI: text input
- `address`
  UI: textarea
- `city`
  UI: text input
- `country`
  UI: text input
- `geo.lat`
  UI: number input
- `geo.lng`
  UI: number input
- `notes`
  UI: textarea

### Permissions

- read/write in admin UI: `admin`, `editor`

### Notes

- Not public by default.
- Existing booking-system rooms still use a plain string location field.

---

## 3.5 People

### Purpose

Manage public personas used in content and event/program relations.

### List view

Columns:

- Photo
- Full Name
- Roles
- Published
- Linked User
- Updated At

Actions:

- create
- edit
- delete
- copy ID

### Filters

- full name
- role
- published / unpublished client-side toggle if needed

### Form fields

- `userId`
  UI: async user select
- `fullName`
  UI: text input
- `roles[]`
  UI: tag input or multi-value text input
- `bio`
  UI: rich textarea or plain multiline textarea
- `photoId`
  UI: media picker
- `contacts[]`
  UI: repeatable rows
  Each row:
  - `network` select
  - `username` text input
  - `hidden` checkbox
  - optional `id` hidden/advanced field if needed
- `socialLinks[]`
  UI: repeatable rows
  Each row:
  - `platform` select
  - `url` text input
- `isPublished`
  UI: switch

### Permissions

- create/edit/delete: `admin`, `editor`
- public reads in API return only published entities

### Notes

- `contacts[]` and `socialLinks[]` are different concepts and should be shown separately in UI.
- `photoId` should use the media picker rather than free text.

---

## 3.6 Partners

### Purpose

Manage partner organizations for public content and event/program relations.

### List view

Columns:

- Logo
- Title
- Type
- Website
- Published
- Updated At

Actions:

- create
- edit
- delete
- copy ID

### Filters

- title
- type

### Form fields

- `title`
  UI: text input
- `type`
  UI: select
  Options:
  - `sponsor`
  - `media`
  - `education`
  - `tech`
  - `other`
- `description`
  UI: textarea
- `logoId`
  UI: media picker
- `website`
  UI: text input
- `contactPerson.name`
  UI: text input
- `contactPerson.email`
  UI: text input
- `contactPerson.phone`
  UI: text input
- `isPublished`
  UI: switch

### Permissions

- create/edit/delete: `admin`, `editor`
- public reads in API return only published entities

---

## 3.7 Programs

### Purpose

Manage domain-owned public programs.

### List view

Columns:

- Title
- Domain
- Kind
- Status
- Format
- Start Date
- Published State Proxy
  Note: derived from `status != draft`
- Updated At

Actions:

- create
- edit
- delete
- copy public URL path
- copy ID

### Filters

- domain
- status
- kind
- format

### Form fields

- `domainId`
  UI: domain select
- `kind`
  UI: select
  Options:
  - `retraining`
  - `school`
  - `long_course`
- `status`
  UI: select
  Options:
  - `draft`
  - `upcoming`
  - `active`
  - `completed`
  - `cancelled`
- `title`
  UI: text input
- `slug`
  UI: text input
- `startDate`
  UI: datetime or timestamp-backed picker
- `endDate`
  UI: datetime or timestamp-backed picker
- `applicationDeadline`
  UI: datetime or timestamp-backed picker
- `format`
  UI: select
  Options:
  - `online`
  - `offline`
  - `hybrid`
- `price`
  UI: grouped fields
  - `currency`
  - `value`
- `modules[]`
  UI: repeatable sortable blocks
  Each block:
  - `title`
  - `description`
  - `order`
  - `durationHours`
- `speakerIds[]`
  UI: people multiselect
- `organizerIds[]`
  UI: people multiselect
- `partnerIds[]`
  UI: partners multiselect

### Permissions

- create/edit/delete: `admin`, `editor`
- public list/item API hides `draft`

### Notes

- `domainId` is required.
- slug uniqueness is per domain, so the form should warn but backend is the final source of truth.

---

## 3.8 Events

### Purpose

Manage domain-owned public events.

### List view

Columns:

- Title
- Domain
- Type
- Status
- Start At
- End At
- Registration Open
- Updated At

Actions:

- create
- edit
- delete
- copy public URL path
- copy ID

### Filters

- domain
- status
- type

### Form fields

- `domainId`
  UI: domain select
- `type`
  UI: select
  Options:
  - `seminar`
  - `workshop`
  - `community_meetup`
  - `training`
  - `webinar`
- `status`
  UI: select
  Options:
  - `draft`
  - `planned`
  - `registration_open`
  - `ongoing`
  - `completed`
  - `cancelled`
- `title`
  UI: text input
- `slug`
  UI: text input
- `startAt`
  UI: datetime or timestamp-backed picker
- `endAt`
  UI: datetime or timestamp-backed picker
- `locationId`
  UI: location select
- `speakerIds[]`
  UI: people multiselect
- `organizerIds[]`
  UI: people multiselect
- `partnerIds[]`
  UI: partners multiselect
- `registration.isOpen`
  UI: switch
- `registration.maxParticipants`
  UI: number input
- `registration.deadline`
  UI: datetime or timestamp-backed picker
- `price`
  UI: grouped fields
  - `currency`
  - `value`
- `capacity`
  UI: number input

### Permissions

- create/edit/delete: `admin`, `editor`
- public list/item API hides `draft`

### Notes

- `domainId` is required.
- `locationId` should use a location picker, not raw text.

---

## 4. Intake Section

## 4.1 Applications

### Purpose

Handle public leads/forms and internal review workflow.

### List view

Columns:

- Created At
- Applicant Name
- Domain
- Form Type
- Status
- Assigned To

Actions:

- open details
- update status
- assign user
- add notes

### Filters

- domain
- form type
- status
- assigned user

### Public form views

Separate public forms should map to specific `formType` values:

- partnership
- program enrollment
- event registration
- corporate training
- specialist request
- general request

### Admin detail view

Recommended layout:

- top summary
  - applicant name
  - createdAt
  - domain
  - form type
  - status
  - assigned user
- applicant contacts block
- source block
- payload block
- notes timeline
- status/assignment actions

### Editable fields in admin

- `status`
  UI: select
  Options:
  - `new`
  - `in_review`
  - `accepted`
  - `rejected`
  - `archived`
- `assignedTo`
  UI: async user select
- `notes[]`
  UI: append-only note composer is recommended, even though current backend accepts whole-array patch

### Public create concerns

- `POST /applications` is public
- throttled to `5 requests / 60 seconds / IP`
- frontend should handle `429` gracefully

### Notes

- The backend currently supports `PATCH` with full note arrays.
- For UI safety, model notes as append-only in the frontend and send the merged array.

---

## 5. Operations Section

This section should mostly mirror the current backend modules and can be implemented in separate admin areas.

### Users

Primary UI:

- user table
- create/edit user form
- assignee picker source for applications and future workflows

### Notifications

Primary UI:

- notification list
- create notification form
- user-targeted notification detail

### Therapy Requests

Primary UI:

- request inbox
- status actions
- psychologist-specific views

### Therapy Sessions

Primary UI:

- session table/calendar
- statistics pages

### Booking System

Primary UI:

- companies
- rooms
- schedules
- bookings

Use `docs/BOOKING-SYSTEM-API.md` as the deeper functional reference.

---

## 6. Permissions Matrix

High-level frontend permissions:

| Section | Read | Write |
|---|---|---|
| Domains | admin/editor UI, public API | admin |
| Media | admin/editor UI, public published API | admin/editor |
| Locations | admin/editor | admin/editor |
| People | admin/editor UI, public published API | admin/editor |
| Partners | admin/editor UI, public published API | admin/editor |
| Programs | admin/editor UI, public non-draft API | admin/editor |
| Events | admin/editor UI, public non-draft API | admin/editor |
| Applications | admin/editor | admin/editor |

Public create:

- Applications only

---

## 7. Recommended Frontend Components

Useful reusable components for this admin panel:

- domain select
- media picker
- location picker
- people multiselect
- partners multiselect
- user select
- publish switch
- status badge
- relation chips
- repeatable field array editor
- notes timeline composer

---

## 8. Current Backend-Driven Caveats

- `locations` are not public API entities right now
- `media` public routes only expose published records
- `media` admin browsing now uses a separate filtered admin route
- `programs` and `events` require `domainId` for list endpoints
- `applications` has no delete route
- `people.contacts[]` reuse the internal contact model, which is not the same as `socialLinks[]`
- `pages` exist as metadata pages, can be domain-scoped or global, and support public slug-based reads; block editing is implemented

---

## 9. Suggested Next UI Docs

The next useful frontend documents would be:

1. route-by-route permissions matrix
2. concrete request/response examples for each create/edit form
3. public website page map using `domains`, `programs`, `events`, `people`, and `partners`
4. future `pages` block editor design once block support exists

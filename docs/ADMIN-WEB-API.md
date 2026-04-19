# Admin / Web API Catalog

This document is a practical API reference for building:

- the public web interface
- the admin panel
- internal frontend tooling for content and operational entities

It reflects the API as currently implemented in `dom-api`.

Related docs:

- `docs/AUTH-API.md`
- `docs/ADMIN-UI-SPEC.md`
- `docs/ROUTE-PERMISSIONS-MATRIX.md`
- `docs/ADMIN-API-EXAMPLES.md`
- `docs/PAGE-BLOCKS-SPEC.md`

---

## 1. Basics

### Base URL

All routes are served from the main API host, for example:

```text
https://api.example.com/
```

### Authentication

The API uses Bearer JWT authentication.

```http
Authorization: Bearer <jwt_token>
```

Public routes use the `@Public()` decorator and do not require a token.

See:

- `docs/AUTH-API.md`

### Roles used by the web/admin UI

- `admin`
- `editor`
- `user`
- `psychologist`

For the newly added content modules:

- write access is usually `admin` or `editor`
- public read access is enabled for selected entities

### Validation / error conventions

Most validation failures return:

```json
{
  "statusCode": 400,
  "message": "Validation failed: ..."
}
```

Common statuses:

- `400` invalid input or invalid references
- `401` unauthenticated
- `403` authenticated but missing role
- `404` entity not found
- `409` uniqueness conflict
- `429` throttled

---

## 2. Current API Areas

The API can be treated as these frontend-facing groups:

### Public content / CMS-like entities

- `domains`
- `pages`
- `menus`
- `media`
- `locations`
- `people`
- `partners`
- `programs`
- `events`
- `applications` (public create only)

### Existing operational entities

- `users`
- `notifications`
- `therapy-requests`
- `therapy-sessions`
- `booking-system/companies`
- `booking-system/rooms`
- `booking-system/schedules`
- `booking-system/bookings`

For deeper booking details, see:

- `docs/BOOKING-SYSTEM-API.md`

---

## 3. Public Content API

## 3.1 Domains

Reference taxonomy for the four main domains.

### Routes

- `GET /domains` public
- `GET /domains/:id` public
- `POST /domains` admin only
- `PATCH /domains/:id` admin only
- `DELETE /domains/:id` admin only

### Shape

```ts
{
  _id: string;
  code: 'psych_center' | 'community' | 'academy' | 'psych_school';
  title: string;
  slug: string;
  isActive: boolean;
  order: number;
  seo: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- populate domain switchers
- validate domain ownership for `programs`, `events`, `applications`

---

## 3.2 Pages

Public/domain pages with embedded `blocks[]`.

### Routes

- `GET /pages` public
- `GET /pages/:id([0-9a-fA-F]{24})` public
- `GET /pages/global/home` public
- `GET /pages/global/:pageSlug` public
- `GET /pages/domain/:domainSlug` public
- `GET /pages/domain/:domainSlug/home` public
- `GET /pages/domain/:domainSlug/:pageSlug` public
- `GET /pages/admin/global` admin/editor
- `GET /pages/admin/:id` admin/editor
- `POST /pages` admin/editor
- `PATCH /pages/:id([0-9a-fA-F]{24})` admin/editor
- `DELETE /pages/:id([0-9a-fA-F]{24})` admin/editor

### Public read behavior

Public `GET` routes return only published pages.

Admin `GET /pages/admin/global` is an intentional raw/admin listing:

- includes global pages regardless of status
- does not apply public block filtering/transforms
- should be used for admin management, not public rendering

Public page responses:

- include `blocks`
- omit blocks where `isVisible === false`
- may omit unresolved `richText.relatedPeople` entries instead of failing the page

### Query params

- `GET /pages`: `domainId`, `limit`, `offset`
- `GET /pages/admin/global`: `limit`, `offset`
- `GET /pages/domain/:domainSlug`: `limit`, `offset`

### Shape

```ts
{
  _id: string;
  domainId?: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  isHomepage: boolean;
  seo?: Record<string, string>;
  blocks: PageBlock[];
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- public global page routing via `/pages/global/:pageSlug`
- public global homepage routing via `/pages/global/home`
- public domain page routing via `/pages/domain/:domainSlug/:pageSlug`
- public domain page indexes via `/pages/domain/:domainSlug`
- public domain homepage routing via `/pages/domain/:domainSlug/home`
- admin global page listing via `/pages/admin/global`
- admin raw page editing via `/pages/admin/:id`
- block-based page management through `POST /pages` and `PATCH /pages/:id`

### Important constraints

- `slug` is globally unique across all `pages` records, including both global and domain pages
- one global homepage is allowed (`isHomepage=true` with no `domainId`)
- one homepage per domain is allowed (`isHomepage=true` with `domainId`)
- only published pages can be marked as homepage
- `gallery.items` are capped at 50 entries in Joi validation

### Block notes

- page blocks are specified in `docs/PAGE-BLOCKS-SPEC.md`
- `blocks` is optional on create/update and may be sent as an empty array
- `richText.description` stores sanitized HTML
- rich text HTML is allowlist-sanitized before persistence
- `richText.relatedPeople` supports labels such as `Authors`
- `entityCollection` is manual-only in v1
- `blocks` are capped at 20 per page in request validation
- `entityCollection.items` are capped at 50 entries
- `anchorId` and `theme` use restricted token-like values

---

## 3.3 Menus

Named global or domain-specific navigation menus with typed items.

### Routes

- `GET /menus/:key` public
- `GET /menus/domain/:domainSlug/:key` public
- `GET /menus` admin/editor
- `GET /menus/:id` admin/editor
- `POST /menus` admin/editor
- `PATCH /menus/:id` admin/editor
- `DELETE /menus/:id` admin/editor

### Public read behavior

Public menu responses:

- return only active menus
- resolve internal links to `resolvedUrl`
- omit broken targets from the public output

### Menu shape

```ts
{
  _id: string;
  key: string;
  title: string;
  domainId?: string;
  isActive: boolean;
  items: Array<{
    id: string;
    title: string;
    type: 'domain' | 'page' | 'external';
    targetId?: string;
    url?: string;
    resolvedUrl?: string;
    order: number;
    isVisible: boolean;
    openInNewTab: boolean;
    isBrokenTarget?: boolean;
    children: MenuItem[];
  }>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- website header/footer/sidebar navigation
- global menus by `key`
- domain-specific menus by `domainSlug + key`
- admin menu editor with resolved and broken-target preview

---

## 3.4 Media

Domain-agnostic asset registry.

### Routes

- `GET /media` public
- `GET /media/admin` admin/editor
- `GET /media/admin/folders` admin/editor
- `GET /media/:id` public
- `GET /media/:id/content` public
- `GET /media/:id/thumbnail` public
- `POST /media` admin/editor
- `POST /media/upload` admin/editor
- `PATCH /media/:id` admin/editor
- `DELETE /media/:id` admin/editor

### Public read behavior

Public `GET` routes return only published media.
For uploaded files, `/media/:id/content` and `/media/:id/thumbnail` return:

- `404` when file is missing (`ENOENT`) or media is not eligible (invalid id, unpublished, external URL)
- `500` for non-ENOENT stream errors

Admin `GET /media/admin` returns the full media library for admin/editor flows and supports upload-oriented filtering.

### Query params

Public:

- `limit`
- `offset`
- `kind`
- `search` partial match on `title`
- `folder` exact match
- `isPublished` exists in validation, but public reads are forced to published items

Admin:

- `limit`
- `offset`
- `kind`
- `search` partial match on `title`
- `folder` exact match
- `createdFrom`
- `createdTo`

### Upload behavior

- `POST /media/upload` accepts `multipart/form-data`
- required field: `file`
- optional fields: `title`, `alt`, `folder`
- v1 supports image uploads only
- uploaded originals are stored in `uploads/media/<year>/<month>/<filename>`
- upload also generates one thumbnail (`maxWidth=320`, aspect ratio preserved, no upscale) in `uploads/thumbnails/<year>/<month>/<filename>`
- thumbnail key is deterministic from the media `storageKey` (same `<year>/<month>/<filename>` under `uploads/thumbnails`)
- GIF uploads preserve animation by copying the original file as the thumbnail (no sharp GIF re-encode)
- uploaded files are served only through API entry points: `GET /media/:id/content` and `GET /media/:id/thumbnail`
- uploaded media records default to `isPublished: true`
- `POST /media` remains supported for external media registration only
- folders are flat string labels (`folder`) and are case-sensitive
- frontend and admin clients must render uploaded assets from the returned `url` field and must not build URLs from `storageKey`

### Folders endpoint behavior

- `GET /media/admin/folders` returns unique non-empty folder names used by media records
- response shape is `string[]`
- values are sorted alphabetically ascending
- root/unassigned records (no `folder`) are not included

### Shape

```ts
{
  _id: string;
  kind: 'image' | 'video' | 'document' | 'other';
  storageKey?: string;
  url: string;
  title: string;
  mimeType?: string;
  sizeBytes?: number;
  alt: string;
  folder?: string;
  width?: number;
  height?: number;
  isPublished: boolean;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- dedicated media library / admin management
- direct upload from admin flows
- thumbnail preview support via `GET /media/:id/thumbnail`
- single-select page-block media picker with `search` and `kind`
- image references for `people`, `partners`, and page blocks
- uploaded asset rendering through the stored `url`, `GET /media/:id/content`, or `GET /media/:id/thumbnail`
- frontend apps such as `dom-web` may proxy uploaded media through their own same-origin route while still consuming the stored `url`

### Selection guidance

- public `GET /media` is the source for published media picker flows
- admin `GET /media/admin` is for full-library management, not page-block selection
- never use raw `/uploads/media/...` or `/uploads/thumbnails/...` URLs in clients; use media API routes only

---

## 3.5 Locations

Reusable venue/address records.

### Routes

- `GET /locations` authenticated
- `GET /locations/:id` authenticated
- `POST /locations` admin/editor
- `PATCH /locations/:id` admin/editor
- `DELETE /locations/:id` admin/editor

### Query params

- `limit`
- `offset`
- `title`
- `city`

### Shape

```ts
{
  _id: string;
  title: string;
  address: string;
  city?: string;
  country?: string;
  geo?: {
    lat: number;
    lng: number;
  };
  notes: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- event venue picker
- reusable address records in admin UI

---

## 3.6 People

Public personas and speakers/organizers.

### Routes

- `GET /people` public
- `GET /people/:id` public
- `POST /people` admin/editor
- `PATCH /people/:id` admin/editor
- `DELETE /people/:id` admin/editor

### Public read behavior

Public `GET` routes return only published people.

### Query params

- `limit`
- `offset`
- `fullName`
- `role` (`founder` | `team` | `speaker` | `organizer` | `community`)

### Allowed person roles

- `founder`
- `team`
- `speaker`
- `organizer`
- `community`

### Shape

```ts
{
  _id: string;
  userId?: string;
  fullName: string;
  roles: Array<'founder' | 'team' | 'speaker' | 'organizer' | 'community'>;
  bio: string;
  photoId?: string; // Media._id
  contacts: Array<{
    id?: string;
    network: 'phone' | 'telegram' | 'instagram' | 'watsapp' | 'viber';
    username: string;
    hidden: boolean;
  }>;
  socialLinks: Array<{
    platform:
      | 'phone'
      | 'telegram'
      | 'instagram'
      | 'watsapp'
      | 'viber'
      | 'other';
    url?: string; // absolute http/https URL, max 300
    value?: string; // trimmed text value, max 300
  }>;
  isPublished: boolean;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

Social links rule: each `socialLinks[]` item must include at least one of `url` or `value` (or both).

### Frontend use

- speaker/organizer management
- public team/founder pages
- relation source for `programs` and `events`

---

## 3.5 Partners

Public partner organizations.

### Routes

- `GET /partners` public
- `GET /partners/:id` public
- `GET /partners/admin` admin/editor
- `GET /partners/admin/:id` admin/editor
- `POST /partners` admin/editor
- `PATCH /partners/:id` admin/editor
- `DELETE /partners/:id` admin/editor

### Public read behavior

Public `GET` routes return only published partners and never include `contacts`.

### Query params

- `limit`
- `offset`
- `title`
- `type`

### Shape

```ts
{
  _id: string;
  title: string;
  type: 'sponsor' | 'media' | 'education' | 'tech' | 'other';
  description: string;
  logoId?: string; // Media._id
  links: Array<{
    platform:
      | 'phone'
      | 'telegram'
      | 'instagram'
      | 'watsapp'
      | 'viber'
      | 'other';
    url?: string; // absolute http/https URL, max 300
    value?: string; // trimmed text value, max 300
  }>;
  contacts?: Array<{
    network: 'phone' | 'telegram' | 'instagram' | 'watsapp' | 'viber' | 'other';
    username: string;
    id?: string;
    hidden?: boolean;
  }>; // admin/editor read routes only
  isPublished: boolean;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

Link rule: each `links[]` item must include at least one of `url` or `value` (or both).
Contacts rule: only admin/editor routes (`/partners/admin*`) expose `contacts`.

### Frontend use

- partner management
- relation source for `programs` and `events`

---

## 3.6 Programs

Domain-owned public education/program records.

### Routes

- `GET /programs` public
- `GET /programs/:id` public
- `POST /programs` admin/editor
- `PATCH /programs/:id` admin/editor
- `DELETE /programs/:id` admin/editor

### Public read behavior

Public reads exclude items with `status = draft`.

### Query params

- `domainId` required on list
- `limit`
- `offset`

### Shape

```ts
{
  _id: string;
  domainId: string; // Domain._id
  kind: 'retraining' | 'school' | 'long_course';
  status: 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';
  title: string;
  slug: string;
  startDate?: number;
  endDate?: number;
  applicationDeadline?: number;
  format: 'online' | 'offline' | 'hybrid';
  priceGroups?: Array<{
    title?: string;
    deadline?: string; // ISO datetime
    price: {
      currency: string;
      value: number;
    };
  }>;
  modules: Array<{
    title: string;
    description: string;
    order: number;
    durationHours?: number;
  }>;
  speakerIds: string[];
  organizerIds: string[];
  partnerIds: string[];
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- public programs catalog
- admin content management
- source entity for applications

### Important constraints

- `domainId` is required on create/update
- slug is unique within a domain, not globally
- referenced `speakerIds`, `organizerIds`, and `partnerIds` must exist

---

## 3.7 Events

Domain-owned public events records.

### Routes

- `GET /events` public
- `GET /events/:id` public
- `POST /events` admin/editor
- `PATCH /events/:id` admin/editor
- `DELETE /events/:id` admin/editor

### Public read behavior

Public reads exclude items with `status = draft`.

### Query params

- `domainId` required on list
- `limit`
- `offset`

### Shape

```ts
{
  _id: string;
  domainId: string; // Domain._id
  type: 'seminar' | 'workshop' | 'community_meetup' | 'training' | 'webinar';
  status: 'draft' | 'planned' | 'registration_open' | 'ongoing' | 'completed' | 'cancelled';
  title: string;
  slug: string;
  startAt: number;
  endAt: number;
  locationId?: string; // Location._id
  speakerIds: string[];
  organizerIds: string[];
  partnerIds: string[];
  registration: {
    isOpen: boolean;
    maxParticipants?: number;
    deadline?: number;
  };
  priceGroups?: Array<{
    title?: string;
    deadline?: string; // ISO datetime
    price: {
      currency: string;
      value: number;
    };
  }>;
  capacity?: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Frontend use

- public events listing
- admin event management
- source entity for applications

### Important constraints

- `domainId` is required on create/update
- slug is unique within a domain
- `locationId`, `speakerIds`, `organizerIds`, `partnerIds` must reference existing records

---

## 3.8 Applications

Public intake forms with admin/editor processing.

### Routes

- `POST /applications` public
- `GET /applications` admin/editor
- `GET /applications/:id` admin/editor
- `PATCH /applications/:id` admin/editor

### Public create throttling

`POST /applications` is throttled:

- `5 requests / 60 seconds / IP`

### Query params for admin list

- `domainId`
- `formType`
- `status`
- `assignedTo`
- `limit`
- `offset`

### Shape

```ts
{
  _id: string;
  domainId: string; // Domain._id
  formType:
    | 'partnership'
    | 'program_enrollment'
    | 'event_registration'
    | 'corporate_training'
    | 'specialist_request'
    | 'general';
  source?: {
    entityType?: 'program' | 'event' | 'partner';
    entityId?: string;
    utm?: Record<string, string>;
  };
  applicant: {
    name: string;
    contacts: Array<{
      id?: string;
      network: string;
      username: string;
      hidden: boolean;
    }>;
  };
  payload: Record<string, unknown>;
  status: 'new' | 'in_review' | 'accepted' | 'rejected' | 'archived';
  assignedTo?: string; // User._id
  notes: Array<{
    text: string;
    authorId: string;
    createdAt: number;
  }>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### Public create payloads

The `payload` object depends on `formType`.

#### `partnership`

```json
{
  "domainId": "<domainId>",
  "formType": "partnership",
  "applicant": {
    "name": "Jane Doe",
    "contacts": [{ "network": "telegram", "username": "jane", "hidden": false }]
  },
  "payload": {
    "organizationName": "Acme",
    "message": "Let's collaborate"
  }
}
```

#### `program_enrollment`

```json
{
  "domainId": "<domainId>",
  "formType": "program_enrollment",
  "applicant": {
    "name": "Jane Doe",
    "contacts": [{ "network": "telegram", "username": "jane", "hidden": false }]
  },
  "payload": {
    "programId": "<programId>",
    "message": "I want to enroll"
  }
}
```

#### `event_registration`

```json
{
  "domainId": "<domainId>",
  "formType": "event_registration",
  "applicant": {
    "name": "Jane Doe",
    "contacts": [{ "network": "telegram", "username": "jane", "hidden": false }]
  },
  "payload": {
    "eventId": "<eventId>",
    "message": "Register me"
  }
}
```

#### `corporate_training`

```json
{
  "domainId": "<domainId>",
  "formType": "corporate_training",
  "applicant": {
    "name": "Jane Doe",
    "contacts": [{ "network": "telegram", "username": "jane", "hidden": false }]
  },
  "payload": {
    "companyName": "Acme",
    "message": "Need training for our team"
  }
}
```

#### `specialist_request`

```json
{
  "domainId": "<domainId>",
  "formType": "specialist_request",
  "applicant": {
    "name": "Jane Doe",
    "contacts": [{ "network": "telegram", "username": "jane", "hidden": false }]
  },
  "payload": {
    "specialization": "Family therapy",
    "message": "Looking for a specialist"
  }
}
```

#### `general`

```json
{
  "domainId": "<domainId>",
  "formType": "general",
  "applicant": {
    "name": "Jane Doe",
    "contacts": [{ "network": "telegram", "username": "jane", "hidden": false }]
  },
  "payload": {
    "message": "General request"
  }
}
```

### Frontend use

- public lead forms
- admin application inbox
- status workflow
- assignment to a user
- internal notes

---

## 4. Existing Operational API

This section is intentionally shorter. It is meant as a frontend catalog, not a full low-level spec.

## 4.1 Users

### Routes

- `GET /users` admin/editor
- `GET /users/me` authenticated
- `GET /users/:id` admin/editor
- `POST /users` admin/editor
- `PUT /users/:id` admin/editor
- `DELETE /users/:id` admin

### Use

- admin user management
- current-user profile loading
- assignee source for internal workflows

---

## 4.2 Notifications

### Routes

- `GET /notifications` admin/editor
- `GET /notifications/users/:userId` admin/editor
- `POST /notifications` admin/editor
- `POST /notifications/:notificationId/add-received/:userId` admin/editor

### Use

- admin notification publishing
- per-user notification lists

---

## 4.3 Therapy Requests

### Routes

- `GET /therapy-requests`
- `GET /therapy-requests/:therapyRequestId`
- `GET /therapy-requests/psychologist/:psychologistId`
- `POST /therapy-requests`
- `POST /therapy-requests/:therapyRequestId/accept`
- `POST /therapy-requests/:therapyRequestId/reject`
- `PUT /therapy-requests/:therapyRequestId`
- `DELETE /therapy-requests/:therapyRequestId`

### Use

- admin / psychologist request processing
- user request submission

---

## 4.4 Therapy Sessions

### Routes

- `GET /therapy-sessions`
- `GET /therapy-sessions/:sessionId`
- `POST /therapy-sessions`
- `POST /therapy-sessions/me`
- `PUT /therapy-sessions/:sessionId`
- `DELETE /therapy-sessions/:sessionId`
- plus period/statistics/psychologist-specific routes

### Use

- operational therapy session management
- psychologist dashboards
- reporting/statistics

---

## 4.5 Booking System

### Areas

- companies
- rooms
- schedules
- bookings

### Full reference

See:

- `docs/BOOKING-SYSTEM-API.md`

The booking system already has a broad admin/operations surface and should likely be treated as a separate frontend module.

---

## 5. Recommended Frontend Modules

For the admin panel, the current API is easiest to work with if the UI is split into these sections:

### Content

- Domains
- Media
- Locations
- People
- Partners
- Programs
- Events

### Intake / CRM-lite

- Applications

### Operations

- Users
- Notifications
- Therapy Requests
- Therapy Sessions
- Booking System

---

## 6. Current Caveats

These are useful to know before frontend work starts:

- `media` public list/item routes are already public, but admin/editor routes use the same resource path
- `locations` reads are authenticated, not public
- `people` uses two different contact-related shapes:
  - `contacts[]` reuse the existing internal contact model
  - `socialLinks[]` are URL-based links
- `programs` and `events` require `domainId` for list reads
- `applications` has no delete route in the current implementation
- `pages` support global pages with no `domainId`, read publicly under `/pages/global/:pageSlug`
- `pages` also support domain-scoped reads under `/pages/domain/:domainSlug/:pageSlug`

---

## 7. Suggested Next Backend Docs

To keep frontend work smooth, the next useful backend docs would be:

1. exact response examples for `programs`, `events`, and `applications`
2. a field-by-field admin form reference for the new modules
3. a permissions matrix by route and role
4. page-builder/block API once `pages.blocks[]` is implemented

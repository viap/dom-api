# Admin API Examples

This document provides example request and response payloads for admin-facing routes.

It is intended as a practical companion to:

- `docs/ADMIN-WEB-API.md`
- `docs/ADMIN-UI-SPEC.md`
- `docs/ROUTE-PERMISSIONS-MATRIX.md`

Conventions:

- IDs are example Mongo ObjectIds
- timestamps are shown in the format currently used by each module
- list endpoints generally return arrays
- `DELETE` on the new content modules returns `204 No Content`

---

## 1. Domains

### `GET /domains`

Response:

```json
[
  {
    "_id": "661000000000000000000001",
    "code": "psych_center",
    "title": "Psych Center",
    "slug": "psych-center",
    "isActive": true,
    "order": 1,
    "seo": {
      "title": "Psych Center"
    },
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /domains`

Request:

```json
{
  "code": "academy",
  "title": "Academy",
  "slug": "academy",
  "isActive": true,
  "order": 3,
  "seo": {
    "title": "Academy",
    "description": "Educational direction"
  }
}
```

Response:

```json
{
  "_id": "661000000000000000000003",
  "code": "academy",
  "title": "Academy",
  "slug": "academy",
  "isActive": true,
  "order": 3,
  "seo": {
    "title": "Academy",
    "description": "Educational direction"
  },
  "createdAt": "2026-04-10T10:15:00.000Z",
  "updatedAt": "2026-04-10T10:15:00.000Z"
}
```

### `PATCH /domains/:id`

Request:

```json
{
  "title": "Academy and Training",
  "order": 4
}
```

Response:

```json
{
  "_id": "661000000000000000000003",
  "code": "academy",
  "title": "Academy and Training",
  "slug": "academy",
  "isActive": true,
  "order": 4,
  "seo": {
    "title": "Academy",
    "description": "Educational direction"
  },
  "createdAt": "2026-04-10T10:15:00.000Z",
  "updatedAt": "2026-04-10T10:20:00.000Z"
}
```

### `DELETE /domains/:id`

Response:

```http
204 No Content
```

---

## 2. Pages

### `GET /pages/global/privacy-policy`

Response:

```json
{
  "_id": "661050000000000000000000",
  "slug": "privacy-policy",
  "title": "Privacy Policy",
  "status": "published",
  "seo": {
    "title": "Privacy Policy",
    "description": "Privacy and data handling."
  },
  "blocks": [],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T08:00:00.000Z",
  "updatedAt": "2026-04-11T08:30:00.000Z"
}
```

### `GET /pages/domain/academy`

Response:

```json
[
  {
    "_id": "661050000000000000000001",
    "domainId": "661000000000000000000003",
    "slug": "about-academy",
    "title": "About Academy",
    "status": "published",
    "seo": {
      "title": "About Academy",
      "description": "Learn about our academy."
    },
    "blocks": [],
    "schemaVersion": 1,
    "createdAt": "2026-04-11T09:00:00.000Z",
    "updatedAt": "2026-04-11T09:30:00.000Z"
  }
]
```

### `GET /pages/domain/academy/about-academy`

Response:

```json
{
  "_id": "661050000000000000000001",
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About Academy",
  "status": "published",
  "isHomepage": false,
  "seo": {
    "title": "About Academy",
    "description": "Learn about our academy."
  },
  "blocks": [],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T09:00:00.000Z",
  "updatedAt": "2026-04-11T09:30:00.000Z"
}
```

### `POST /pages` domain page

Request:

```json
{
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About Academy",
  "status": "published",
  "seo": {
    "title": "About Academy",
    "description": "Learn about our academy."
  },
  "blocks": [
    {
      "id": "intro-authors",
      "type": "richText",
      "title": "About the program",
      "description": "<p>Introductory content.</p>",
      "relatedPeople": {
        "title": "Authors",
        "peopleIds": ["661040000000000000000001", "661040000000000000000002"]
      }
    }
  ]
}
```

Response:

```json
{
  "_id": "661050000000000000000001",
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About Academy",
  "status": "published",
  "seo": {
    "title": "About Academy",
    "description": "Learn about our academy."
  },
  "blocks": [
    {
      "id": "intro-authors",
      "type": "richText",
      "title": "About the program",
      "description": "<p>Introductory content.</p>",
      "relatedPeople": {
        "title": "Authors",
        "peopleIds": ["661040000000000000000001", "661040000000000000000002"]
      }
    }
  ],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T09:00:00.000Z",
  "updatedAt": "2026-04-11T09:00:00.000Z"
}
```

### `POST /pages` global page with no blocks

Request:

```json
{
  "slug": "about",
  "title": "About",
  "status": "published",
  "isHomepage": false,
  "seo": {},
  "blocks": []
}
```

Response:

```json
{
  "_id": "661050000000000000000010",
  "slug": "about",
  "title": "About",
  "status": "published",
  "isHomepage": false,
  "seo": {},
  "blocks": [],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T11:00:00.000Z",
  "updatedAt": "2026-04-11T11:00:00.000Z"
}
```

### `GET /pages/admin/661050000000000000000001`

Response:

```json
{
  "_id": "661050000000000000000001",
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About Academy",
  "status": "draft",
  "isHomepage": false,
  "seo": {
    "title": "About Academy",
    "description": "Learn about our academy."
  },
  "blocks": [
    {
      "id": "intro-authors",
      "type": "richText",
      "title": "About the program",
      "description": "<p>Introductory content.</p>",
      "relatedPeople": {
        "title": "Authors",
        "peopleIds": ["661040000000000000000001", "661040000000000000000002"],
        "display": "inline"
      }
    },
    {
      "id": "featured-people",
      "type": "entityCollection",
      "title": "Meet the team",
      "entityType": "people",
      "layout": "grid",
      "items": ["661040000000000000000001", "661040000000000000000002"]
    }
  ],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T09:00:00.000Z",
  "updatedAt": "2026-04-11T09:45:00.000Z"
}
```

### `GET /pages/admin/global?limit=20&offset=0`

Response:

```json
[
  {
    "_id": "661050000000000000000000",
    "slug": "privacy-policy",
    "title": "Privacy Policy",
    "status": "published",
    "isHomepage": false,
    "seo": {
      "title": "Privacy Policy",
      "description": "Privacy and data handling."
    },
    "blocks": [],
    "schemaVersion": 1,
    "createdAt": "2026-04-11T08:00:00.000Z",
    "updatedAt": "2026-04-11T08:30:00.000Z"
  }
]
```

### `POST /pages` global page

Request:

```json
{
  "slug": "privacy-policy",
  "title": "Privacy Policy",
  "status": "published",
  "isHomepage": false,
  "seo": {
    "title": "Privacy Policy",
    "description": "Privacy and data handling."
  }
}
```

Response:

```json
{
  "_id": "661050000000000000000000",
  "slug": "privacy-policy",
  "title": "Privacy Policy",
  "status": "published",
  "seo": {
    "title": "Privacy Policy",
    "description": "Privacy and data handling."
  },
  "schemaVersion": 1,
  "createdAt": "2026-04-11T08:00:00.000Z",
  "updatedAt": "2026-04-11T08:00:00.000Z"
}
```

### `PATCH /pages/:id`

Request:

```json
{
  "title": "About the Academy"
}
```

Response:

```json
{
  "_id": "661050000000000000000001",
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About the Academy",
  "status": "published",
  "isHomepage": false,
  "seo": {
    "title": "About Academy",
    "description": "Learn about our academy."
  },
  "schemaVersion": 1,
  "createdAt": "2026-04-11T09:00:00.000Z",
  "updatedAt": "2026-04-11T09:40:00.000Z"
}
```

### `PATCH /pages/:id` set domain homepage

Request:

```json
{
  "status": "published",
  "isHomepage": true
}
```

Response:

```json
{
  "_id": "661050000000000000000001",
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About the Academy",
  "status": "published",
  "isHomepage": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-11T09:00:00.000Z",
  "updatedAt": "2026-04-11T10:00:00.000Z"
}
```

### `GET /pages/domain/academy/home`

Response:

```json
{
  "_id": "661050000000000000000001",
  "domainId": "661000000000000000000003",
  "slug": "about-academy",
  "title": "About the Academy",
  "status": "published",
  "isHomepage": true,
  "blocks": [],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T09:00:00.000Z",
  "updatedAt": "2026-04-11T10:00:00.000Z"
}
```

### `GET /pages/global/home`

Response:

```json
{
  "_id": "661050000000000000000000",
  "slug": "privacy-policy",
  "title": "Privacy Policy",
  "status": "published",
  "isHomepage": true,
  "blocks": [],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T08:00:00.000Z",
  "updatedAt": "2026-04-11T10:05:00.000Z"
}
```

### `DELETE /pages/:id`

Response:

```http
204 No Content
```

### `GET /pages/:id` invalid non-ObjectId

Request:

```http
GET /pages/not-an-object-id
```

Response:

```http
404 Not Found
```

---

## 3. Menus

### `GET /menus/main`

Response:

```json
{
  "_id": "661060000000000000000001",
  "key": "main",
  "title": "Main Navigation",
  "isActive": true,
  "items": [
    {
      "id": "menu-1",
      "title": "Academy",
      "type": "domain",
      "targetId": "661000000000000000000003",
      "resolvedUrl": "/academy",
      "order": 0,
      "isVisible": true,
      "openInNewTab": false,
      "children": []
    },
    {
      "id": "menu-2",
      "title": "Privacy Policy",
      "type": "page",
      "targetId": "661050000000000000000000",
      "resolvedUrl": "/privacy-policy",
      "order": 1,
      "isVisible": true,
      "openInNewTab": false,
      "children": []
    }
  ],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T12:00:00.000Z",
  "updatedAt": "2026-04-11T12:00:00.000Z"
}
```

### `GET /menus/domain/academy/main`

Response:

```json
{
  "_id": "661060000000000000000002",
  "key": "main",
  "title": "Academy Main Navigation",
  "domainId": "661000000000000000000003",
  "isActive": true,
  "items": [
    {
      "id": "menu-10",
      "title": "About Academy",
      "type": "page",
      "targetId": "661050000000000000000001",
      "resolvedUrl": "/academy/about-academy",
      "order": 0,
      "isVisible": true,
      "openInNewTab": false,
      "children": []
    }
  ],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T12:10:00.000Z",
  "updatedAt": "2026-04-11T12:10:00.000Z"
}
```

### `POST /menus`

Request:

```json
{
  "key": "footer",
  "title": "Footer Navigation",
  "items": [
    {
      "title": "External Link",
      "type": "external",
      "url": "https://example.com",
      "order": 0,
      "children": []
    },
    {
      "title": "Pages",
      "type": "page",
      "targetId": "661050000000000000000000",
      "order": 1,
      "children": [
        {
          "title": "Academy",
          "type": "page",
          "targetId": "661050000000000000000001",
          "order": 0
        }
      ]
    }
  ]
}
```

Response:

```json
{
  "_id": "661060000000000000000003",
  "key": "footer",
  "title": "Footer Navigation",
  "isActive": true,
  "items": [
    {
      "id": "generated-item-1",
      "title": "External Link",
      "type": "external",
      "url": "https://example.com",
      "resolvedUrl": "https://example.com",
      "order": 0,
      "isVisible": true,
      "openInNewTab": false,
      "children": []
    }
  ],
  "schemaVersion": 1,
  "createdAt": "2026-04-11T12:20:00.000Z",
  "updatedAt": "2026-04-11T12:20:00.000Z"
}
```

---

## 4. Media

### `GET /media?limit=20&offset=0`

Response:

```json
[
  {
    "_id": "661100000000000000000001",
    "kind": "image",
    "url": "https://cdn.example.com/people/olga-profile.jpg",
    "title": "Olga profile photo",
    "mimeType": "image/jpeg",
    "sizeBytes": 248311,
    "alt": "Olga portrait",
    "folder": "people",
    "width": 1200,
    "height": 1600,
    "isPublished": true,
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `GET /media/admin?kind=image&search=foundation&createdFrom=2026-04-01T00:00:00.000Z&createdTo=2026-04-30T23:59:59.999Z`

Response:

```json
[
  {
    "_id": "661100000000000000000010",
    "kind": "image",
    "storageKey": "2026/04/1712744700000-a3d9f63d-cover.png",
    "url": "/media/661100000000000000000010/content",
    "title": "Foundation course cover",
    "mimeType": "image/png",
    "sizeBytes": 512044,
    "alt": "Course cover image",
    "folder": "courses",
    "width": 1440,
    "height": 900,
    "isPublished": true,
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:25:00.000Z",
    "updatedAt": "2026-04-10T10:25:00.000Z"
  }
]
```

### `POST /media/upload`

Request:

```http
POST /media/upload
Content-Type: multipart/form-data

file=<binary image>
title=Foundation course cover
alt=Course cover image
folder=courses
```

Response:

```json
{
  "_id": "661100000000000000000010",
  "kind": "image",
  "storageKey": "2026/04/1712744700000-a3d9f63d-cover.png",
  "url": "/media/661100000000000000000010/content",
  "title": "Foundation course cover",
  "mimeType": "image/png",
  "sizeBytes": 512044,
  "alt": "Course cover image",
  "folder": "courses",
  "width": 1440,
  "height": 900,
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:25:00.000Z",
  "updatedAt": "2026-04-10T10:25:00.000Z"
}
```

Notes:

- GIF uploads preserve animation for thumbnails by copying the original GIF file.

### `POST /media` external media mode

Request:

```json
{
  "kind": "image",
  "url": "https://cdn.example.com/programs/foundation-course-cover.jpg",
  "title": "Foundation course cover",
  "mimeType": "image/jpeg",
  "sizeBytes": 512044,
  "alt": "Course cover image",
  "folder": "courses",
  "width": 1440,
  "height": 900,
  "isPublished": true
}
```

Response:

```json
{
  "_id": "661100000000000000000010",
  "kind": "image",
  "url": "https://cdn.example.com/programs/foundation-course-cover.jpg",
  "title": "Foundation course cover",
  "mimeType": "image/jpeg",
  "sizeBytes": 512044,
  "alt": "Course cover image",
  "folder": "courses",
  "width": 1440,
  "height": 900,
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:25:00.000Z",
  "updatedAt": "2026-04-10T10:25:00.000Z"
}
```

### `PATCH /media/:id`

Request:

```json
{
  "title": "Foundation course hero image",
  "alt": "Students in lecture hall",
  "folder": "hero"
}
```

Response:

```json
{
  "_id": "661100000000000000000010",
  "kind": "image",
  "url": "https://cdn.example.com/programs/foundation-course-cover.jpg",
  "title": "Foundation course hero image",
  "mimeType": "image/jpeg",
  "sizeBytes": 512044,
  "alt": "Students in lecture hall",
  "folder": "hero",
  "width": 1440,
  "height": 900,
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:25:00.000Z",
  "updatedAt": "2026-04-10T10:27:00.000Z"
}
```

### `GET /media/admin/folders`

Response:

```json
["courses", "events", "people"]
```

### `GET /media/:id/content`

Response:

```http
200 OK
Content-Type: image/png

<binary image bytes>
```

### `GET /media/:id/content` missing file

Response:

```http
404 Not Found
Content-Type: application/json

{"message":"Media content not found","error":"Not Found","statusCode":404}
```

### `GET /media/:id/thumbnail`

Response:

```http
200 OK
Content-Type: image/png

<binary thumbnail bytes>
```

Notes:

- returned thumbnail corresponds to uploaded media only
- generated at upload time with `maxWidth=320` and preserved aspect ratio
- raw `/uploads/thumbnails/...` paths are intentionally blocked; use this endpoint

### `GET /media/:id/thumbnail` missing file

Response:

```http
404 Not Found
Content-Type: application/json

{"message":"Media thumbnail not found","error":"Not Found","statusCode":404}
```

### `DELETE /media/:id`

Response:

```http
204 No Content
```

---

## 3. Locations

### `GET /locations?city=Tbilisi`

Response:

```json
[
  {
    "_id": "661200000000000000000001",
    "title": "Dom Hall",
    "address": "12 Rustaveli Ave",
    "city": "Tbilisi",
    "country": "Georgia",
    "geo": {
      "lat": 41.6995,
      "lng": 44.7909
    },
    "notes": "Main event venue",
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /locations`

Request:

```json
{
  "title": "Training Room A",
  "address": "24 Pekini Ave",
  "city": "Tbilisi",
  "country": "Georgia",
  "geo": {
    "lat": 41.7222,
    "lng": 44.7703
  },
  "notes": "Second floor"
}
```

Response:

```json
{
  "_id": "661200000000000000000002",
  "title": "Training Room A",
  "address": "24 Pekini Ave",
  "city": "Tbilisi",
  "country": "Georgia",
  "geo": {
    "lat": 41.7222,
    "lng": 44.7703
  },
  "notes": "Second floor",
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:30:00.000Z",
  "updatedAt": "2026-04-10T10:30:00.000Z"
}
```

### `PATCH /locations/:id`

Request:

```json
{
  "notes": "Second floor, front entrance"
}
```

Response:

```json
{
  "_id": "661200000000000000000002",
  "title": "Training Room A",
  "address": "24 Pekini Ave",
  "city": "Tbilisi",
  "country": "Georgia",
  "geo": {
    "lat": 41.7222,
    "lng": 44.7703
  },
  "notes": "Second floor, front entrance",
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:30:00.000Z",
  "updatedAt": "2026-04-10T10:32:00.000Z"
}
```

### `DELETE /locations/:id`

Response:

```http
204 No Content
```

---

## 4. People

### `GET /people?limit=20&offset=0`

Response:

```json
[
  {
    "_id": "661300000000000000000001",
    "userId": "660900000000000000000010",
    "fullName": "Olga Chkheidze",
    "roles": ["speaker", "community"],
    "bio": "Psychotherapist and lecturer.",
    "photoId": "661100000000000000000001",
    "contacts": [
      {
        "network": "telegram",
        "username": "@olga",
        "hidden": false
      }
    ],
    "socialLinks": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/olga"
      },
      {
        "platform": "telegram",
        "value": "@olga"
      }
    ],
    "isPublished": true,
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /people`

Request:

```json
{
  "userId": "660900000000000000000010",
  "fullName": "Nino M.",
  "roles": ["team", "speaker"],
  "bio": "Community moderator and event host.",
  "photoId": "661100000000000000000001",
  "contacts": [
    {
      "network": "telegram",
      "username": "@nino",
      "hidden": false
    }
  ],
  "socialLinks": [
    {
      "platform": "instagram",
      "url": "https://instagram.com/nino",
      "value": "@nino"
    }
  ],
  "isPublished": true
}
```

Response:

```json
{
  "_id": "661300000000000000000002",
  "userId": "660900000000000000000010",
  "fullName": "Nino M.",
  "roles": ["team", "speaker"],
  "bio": "Community moderator and event host.",
  "photoId": "661100000000000000000001",
  "contacts": [
    {
      "network": "telegram",
      "username": "@nino",
      "hidden": false
    }
  ],
  "socialLinks": [
    {
      "platform": "instagram",
      "url": "https://instagram.com/nino",
      "value": "@nino"
    }
  ],
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:35:00.000Z",
  "updatedAt": "2026-04-10T10:35:00.000Z"
}
```

### `PATCH /people/:id`

Request:

```json
{
  "bio": "Community moderator, speaker, and curator."
}
```

Response:

```json
{
  "_id": "661300000000000000000002",
  "userId": "660900000000000000000010",
  "fullName": "Nino M.",
  "roles": ["team", "speaker"],
  "bio": "Community moderator, speaker, and curator.",
  "photoId": "661100000000000000000001",
  "contacts": [
    {
      "network": "telegram",
      "username": "@nino",
      "hidden": false
    }
  ],
  "socialLinks": [
    {
      "platform": "instagram",
      "url": "https://instagram.com/nino",
      "value": "@nino"
    }
  ],
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:35:00.000Z",
  "updatedAt": "2026-04-10T10:40:00.000Z"
}
```

### `DELETE /people/:id`

Response:

```http
204 No Content
```

---

## 5. Partners

### `GET /partners?type=sponsor`

Response:

```json
[
  {
    "_id": "661400000000000000000001",
    "title": "Mindful Co",
    "type": "sponsor",
    "description": "Annual conference partner.",
    "logoId": "661100000000000000000020",
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/mindful",
        "value": "@mindful"
      }
    ],
    "isPublished": true,
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `GET /partners/admin?type=sponsor`

Response:

```json
[
  {
    "_id": "661400000000000000000001",
    "title": "Mindful Co",
    "type": "sponsor",
    "description": "Annual conference partner.",
    "logoId": "661100000000000000000020",
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/mindful",
        "value": "@mindful"
      }
    ],
    "contacts": [
      {
        "network": "telegram",
        "username": "@mindful_support",
        "hidden": false
      }
    ],
    "isPublished": true,
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /partners`

Request:

```json
{
  "title": "Education Hub",
  "type": "education",
  "description": "Training partner for the academy track.",
  "logoId": "661100000000000000000020",
  "links": [
    {
      "platform": "instagram",
      "url": "https://instagram.com/education_hub"
    },
    {
      "platform": "telegram",
      "value": "@education_hub"
    }
  ],
  "contacts": [
    {
      "network": "telegram",
      "username": "@education_hub",
      "hidden": false
    }
  ],
  "isPublished": true
}
```

Response:

```json
{
  "_id": "661400000000000000000002",
  "title": "Education Hub",
  "type": "education",
  "description": "Training partner for the academy track.",
  "logoId": "661100000000000000000020",
  "links": [
    {
      "platform": "instagram",
      "url": "https://instagram.com/education_hub"
    },
    {
      "platform": "telegram",
      "value": "@education_hub"
    }
  ],
  "contacts": [
    {
      "network": "telegram",
      "username": "@education_hub",
      "hidden": false
    }
  ],
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:45:00.000Z",
  "updatedAt": "2026-04-10T10:45:00.000Z"
}
```

### `PATCH /partners/:id`

Request:

```json
{
  "description": "Training and scholarship partner."
}
```

Response:

```json
{
  "_id": "661400000000000000000002",
  "title": "Education Hub",
  "type": "education",
  "description": "Training and scholarship partner.",
  "logoId": "661100000000000000000020",
  "links": [
    {
      "platform": "instagram",
      "url": "https://instagram.com/education_hub"
    },
    {
      "platform": "telegram",
      "value": "@education_hub"
    }
  ],
  "contacts": [
    {
      "network": "telegram",
      "username": "@education_hub",
      "hidden": false
    }
  ],
  "isPublished": true,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:45:00.000Z",
  "updatedAt": "2026-04-10T10:48:00.000Z"
}
```

### `DELETE /partners/:id`

Response:

```http
204 No Content
```

---

## 6. Programs

### `GET /programs?domainId=661000000000000000000003&status=active`

Response:

```json
[
  {
    "_id": "661500000000000000000001",
    "domainId": "661000000000000000000003",
    "kind": "long_course",
    "status": "active",
    "title": "Foundation Program",
    "slug": "foundation-program",
    "startDate": "2026-04-05T00:00:00.000Z",
    "endDate": "2026-05-05T00:00:00.000Z",
    "applicationDeadline": "2026-03-29T00:00:00.000Z",
    "format": "hybrid",
    "priceGroups": [
      {
        "title": "Regular",
        "deadline": "2026-04-20T00:00:00.000Z",
        "price": {
          "value": 1200,
          "currency": "gel"
        }
      }
    ],
    "modules": [
      {
        "title": "Introduction",
        "description": "Kickoff block",
        "order": 1,
        "durationHours": 6
      }
    ],
    "speakerIds": ["661300000000000000000001"],
    "organizerIds": ["661300000000000000000002"],
    "partnerIds": ["661400000000000000000002"],
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /programs`

Request:

```json
{
  "domainId": "661000000000000000000003",
  "kind": "retraining",
  "status": "upcoming",
  "title": "Counseling Skills Intensive",
  "slug": "counseling-skills-intensive",
  "startDate": "2026-04-05T00:00:00.000Z",
  "endDate": "2026-04-12T00:00:00.000Z",
  "applicationDeadline": "2026-03-29T00:00:00.000Z",
  "format": "online",
  "priceGroups": [
    {
      "title": "Early bird",
      "deadline": "2026-04-20T00:00:00.000Z",
      "price": {
        "value": 950,
        "currency": "gel"
      }
    }
  ],
  "modules": [
    {
      "title": "Core theory",
      "description": "Base curriculum",
      "order": 1,
      "durationHours": 8
    }
  ],
  "speakerIds": ["661300000000000000000001"],
  "organizerIds": ["661300000000000000000002"],
  "partnerIds": ["661400000000000000000002"]
}
```

Response:

```json
{
  "_id": "661500000000000000000002",
  "domainId": "661000000000000000000003",
  "kind": "retraining",
  "status": "upcoming",
  "title": "Counseling Skills Intensive",
  "slug": "counseling-skills-intensive",
  "startDate": "2026-04-05T00:00:00.000Z",
  "endDate": "2026-04-12T00:00:00.000Z",
  "applicationDeadline": "2026-03-29T00:00:00.000Z",
  "format": "online",
  "priceGroups": [
    {
      "title": "Early bird",
      "deadline": "2026-04-20T00:00:00.000Z",
      "price": {
        "value": 950,
        "currency": "gel"
      }
    }
  ],
  "modules": [
    {
      "title": "Core theory",
      "description": "Base curriculum",
      "order": 1,
      "durationHours": 8
    }
  ],
  "speakerIds": ["661300000000000000000001"],
  "organizerIds": ["661300000000000000000002"],
  "partnerIds": ["661400000000000000000002"],
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:50:00.000Z",
  "updatedAt": "2026-04-10T10:50:00.000Z"
}
```

### `PATCH /programs/:id`

Request:

```json
{
  "status": "active",
  "priceGroups": [
    {
      "title": "Regular",
      "deadline": "2026-04-25T00:00:00.000Z",
      "price": {
        "value": 1000,
        "currency": "gel"
      }
    }
  ]
}
```

Response:

```json
{
  "_id": "661500000000000000000002",
  "domainId": "661000000000000000000003",
  "kind": "retraining",
  "status": "active",
  "title": "Counseling Skills Intensive",
  "slug": "counseling-skills-intensive",
  "startDate": "2026-04-05T00:00:00.000Z",
  "endDate": "2026-04-12T00:00:00.000Z",
  "applicationDeadline": "2026-03-29T00:00:00.000Z",
  "format": "online",
  "priceGroups": [
    {
      "title": "Regular",
      "deadline": "2026-04-25T00:00:00.000Z",
      "price": {
        "value": 1000,
        "currency": "gel"
      }
    }
  ],
  "modules": [
    {
      "title": "Core theory",
      "description": "Base curriculum",
      "order": 1,
      "durationHours": 8
    }
  ],
  "speakerIds": ["661300000000000000000001"],
  "organizerIds": ["661300000000000000000002"],
  "partnerIds": ["661400000000000000000002"],
  "schemaVersion": 1,
  "createdAt": "2026-04-10T10:50:00.000Z",
  "updatedAt": "2026-04-10T10:55:00.000Z"
}
```

### `DELETE /programs/:id`

Response:

```http
204 No Content
```

---

## 7. Events

### `GET /events?domainId=661000000000000000000001&status=planned`

Response:

```json
[
  {
    "_id": "661600000000000000000001",
    "domainId": "661000000000000000000001",
    "type": "workshop",
    "status": "planned",
    "title": "Trauma-Informed Practice Workshop",
    "slug": "trauma-informed-practice-workshop",
    "startAt": "2026-04-13T00:00:00.000Z",
    "endAt": "2026-04-13T03:00:00.000Z",
    "locationId": "661200000000000000000001",
    "speakerIds": ["661300000000000000000001"],
    "organizerIds": ["661300000000000000000002"],
    "partnerIds": ["661400000000000000000001"],
    "registration": {
      "isOpen": true,
      "maxParticipants": 40,
      "deadline": "2026-04-12T00:00:00.000Z"
    },
    "priceGroups": [
      {
        "title": "Standard ticket",
        "deadline": "2026-04-20T00:00:00.000Z",
        "price": {
          "value": 120,
          "currency": "gel"
        }
      }
    ],
    "capacity": 40,
    "schemaVersion": 1,
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /events`

Request:

```json
{
  "domainId": "661000000000000000000001",
  "type": "seminar",
  "status": "registration_open",
  "title": "Open Seminar on Burnout",
  "slug": "open-seminar-on-burnout",
  "startAt": "2026-04-13T00:00:00.000Z",
  "endAt": "2026-04-13T02:00:00.000Z",
  "locationId": "661200000000000000000001",
  "speakerIds": ["661300000000000000000001"],
  "organizerIds": ["661300000000000000000002"],
  "partnerIds": ["661400000000000000000001"],
  "registration": {
    "isOpen": true,
    "maxParticipants": 80,
    "deadline": "2026-04-12T00:00:00.000Z"
  },
  "priceGroups": [
    {
      "title": "Free registration",
      "deadline": "2026-04-20T00:00:00.000Z",
      "price": {
        "value": 0,
        "currency": "gel"
      }
    }
  ],
  "capacity": 80
}
```

Response:

```json
{
  "_id": "661600000000000000000002",
  "domainId": "661000000000000000000001",
  "type": "seminar",
  "status": "registration_open",
  "title": "Open Seminar on Burnout",
  "slug": "open-seminar-on-burnout",
  "startAt": "2026-04-13T00:00:00.000Z",
  "endAt": "2026-04-13T02:00:00.000Z",
  "locationId": "661200000000000000000001",
  "speakerIds": ["661300000000000000000001"],
  "organizerIds": ["661300000000000000000002"],
  "partnerIds": ["661400000000000000000001"],
  "registration": {
    "isOpen": true,
    "maxParticipants": 80,
    "deadline": "2026-04-12T00:00:00.000Z"
  },
  "priceGroups": [
    {
      "title": "Free registration",
      "deadline": "2026-04-20T00:00:00.000Z",
      "price": {
        "value": 0,
        "currency": "gel"
      }
    }
  ],
  "capacity": 80,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T11:00:00.000Z",
  "updatedAt": "2026-04-10T11:00:00.000Z"
}
```

### `PATCH /events/:id`

Request:

```json
{
  "status": "ongoing",
  "registration": {
    "isOpen": false,
    "maxParticipants": 80,
    "deadline": "2026-04-12T00:00:00.000Z"
  },
  "priceGroups": [
    {
      "title": "Door price",
      "deadline": "2026-04-20T00:00:00.000Z",
      "price": {
        "value": 0,
        "currency": "gel"
      }
    }
  ]
}
```

Response:

```json
{
  "_id": "661600000000000000000002",
  "domainId": "661000000000000000000001",
  "type": "seminar",
  "status": "ongoing",
  "title": "Open Seminar on Burnout",
  "slug": "open-seminar-on-burnout",
  "startAt": "2026-04-13T00:00:00.000Z",
  "endAt": "2026-04-13T02:00:00.000Z",
  "locationId": "661200000000000000000001",
  "speakerIds": ["661300000000000000000001"],
  "organizerIds": ["661300000000000000000002"],
  "partnerIds": ["661400000000000000000001"],
  "registration": {
    "isOpen": false,
    "maxParticipants": 80,
    "deadline": "2026-04-12T00:00:00.000Z"
  },
  "priceGroups": [
    {
      "title": "Door price",
      "deadline": "2026-04-20T00:00:00.000Z",
      "price": {
        "value": 0,
        "currency": "gel"
      }
    }
  ],
  "capacity": 80,
  "schemaVersion": 1,
  "createdAt": "2026-04-10T11:00:00.000Z",
  "updatedAt": "2026-04-10T11:10:00.000Z"
}
```

### `DELETE /events/:id`

Response:

```http
204 No Content
```

---

## 8. Applications

### `GET /applications?domainId=661000000000000000000001&status=new`

Response:

```json
[
  {
    "_id": "661700000000000000000001",
    "domainId": "661000000000000000000001",
    "formType": "event_registration",
    "status": "new",
    "source": {
      "entityType": "events",
      "entityId": "661600000000000000000002",
      "utm": {
        "source": "instagram",
        "campaign": "burnout-seminar"
      }
    },
    "applicant": {
      "name": "Ana D.",
      "contacts": [
        {
          "network": "email",
          "username": "ana@example.com",
          "hidden": false
        }
      ]
    },
    "payload": {
      "ticketCount": 1,
      "comment": "Please confirm by email"
    },
    "notes": [],
    "schemaVersion": 1,
    "createdAt": "2026-04-10T11:15:00.000Z",
    "updatedAt": "2026-04-10T11:15:00.000Z"
  }
]
```

### `PATCH /applications/:id`

Request:

```json
{
  "status": "in_review",
  "assignedTo": "660900000000000000000010",
  "notes": [
    {
      "text": "Called applicant, waiting for confirmation.",
      "authorId": "660900000000000000000001",
      "createdAt": "2026-04-10T11:20:00.000Z"
    }
  ]
}
```

Response:

```json
{
  "_id": "661700000000000000000001",
  "domainId": "661000000000000000000001",
  "formType": "event_registration",
  "status": "in_review",
  "source": {
    "entityType": "events",
    "entityId": "661600000000000000000002",
    "utm": {
      "source": "instagram",
      "campaign": "burnout-seminar"
    }
  },
  "applicant": {
    "name": "Ana D.",
    "contacts": [
      {
        "network": "email",
        "username": "ana@example.com",
        "hidden": false
      }
    ]
  },
  "payload": {
    "ticketCount": 1,
    "comment": "Please confirm by email"
  },
  "assignedTo": "660900000000000000000010",
  "notes": [
    {
      "text": "Called applicant, waiting for confirmation.",
      "authorId": "660900000000000000000001",
      "createdAt": "2026-04-10T11:20:00.000Z"
    }
  ],
  "schemaVersion": 1,
  "createdAt": "2026-04-10T11:15:00.000Z",
  "updatedAt": "2026-04-10T11:20:00.000Z"
}
```

### `POST /applications`

This route is public rather than admin-only, but it is useful for admin QA and frontend integration.

Request:

```json
{
  "domainId": "661000000000000000000001",
  "formType": "event_registration",
  "source": {
    "entityType": "events",
    "entityId": "661600000000000000000002",
    "utm": {
      "source": "instagram",
      "campaign": "burnout-seminar"
    }
  },
  "applicant": {
    "name": "Ana D.",
    "contacts": [
      {
        "network": "email",
        "username": "ana@example.com",
        "hidden": false
      }
    ]
  },
  "payload": {
    "ticketCount": 1,
    "comment": "Please confirm by email"
  }
}
```

Response:

```json
{
  "_id": "661700000000000000000001",
  "domainId": "661000000000000000000001",
  "formType": "event_registration",
  "status": "new",
  "source": {
    "entityType": "events",
    "entityId": "661600000000000000000002",
    "utm": {
      "source": "instagram",
      "campaign": "burnout-seminar"
    }
  },
  "applicant": {
    "name": "Ana D.",
    "contacts": [
      {
        "network": "email",
        "username": "ana@example.com",
        "hidden": false
      }
    ]
  },
  "payload": {
    "ticketCount": 1,
    "comment": "Please confirm by email"
  },
  "notes": [],
  "schemaVersion": 1,
  "createdAt": "2026-04-10T11:15:00.000Z",
  "updatedAt": "2026-04-10T11:15:00.000Z"
}
```

---

## 9. Users

### `GET /users`

Response:

```json
[
  {
    "_id": "660900000000000000000001",
    "name": "Admin User",
    "login": "admin",
    "roles": ["admin"],
    "descr": "Main administrator",
    "contacts": [
      {
        "network": "email",
        "username": "admin@example.com",
        "hidden": false
      }
    ],
    "timeZone": "Asia/Tbilisi"
  }
]
```

### `POST /users`

Request:

```json
{
  "name": "Editor User",
  "login": "editor",
  "password": "strong-password",
  "roles": ["editor"],
  "descr": "Content editor",
  "contacts": [
    {
      "network": "email",
      "username": "editor@example.com",
      "hidden": false
    }
  ],
  "timeZone": "Asia/Tbilisi"
}
```

Response:

```json
{
  "_id": "660900000000000000000002",
  "name": "Editor User",
  "login": "editor",
  "roles": ["editor"],
  "descr": "Content editor",
  "contacts": [
    {
      "network": "email",
      "username": "editor@example.com",
      "hidden": false
    }
  ],
  "timeZone": "Asia/Tbilisi"
}
```

### `PUT /users/:id`

Request:

```json
{
  "roles": ["editor", "psychologist"],
  "descr": "Content editor and specialist"
}
```

Response:

```json
{
  "_id": "660900000000000000000002",
  "name": "Editor User",
  "login": "editor",
  "roles": ["editor", "psychologist"],
  "descr": "Content editor and specialist",
  "contacts": [
    {
      "network": "email",
      "username": "editor@example.com",
      "hidden": false
    }
  ],
  "timeZone": "Asia/Tbilisi"
}
```

### `DELETE /users/:id`

Response:

```json
{
  "_id": "660900000000000000000002",
  "name": "Editor User",
  "login": "editor",
  "roles": ["editor", "psychologist"],
  "descr": "Content editor and specialist",
  "contacts": [
    {
      "network": "email",
      "username": "editor@example.com",
      "hidden": false
    }
  ],
  "timeZone": "Asia/Tbilisi"
}
```

---

## 10. Notifications

### `GET /notifications`

Response:

```json
[
  {
    "_id": "661800000000000000000001",
    "type": "COMMON",
    "status": "ACTIVE",
    "title": "System maintenance",
    "message": "The platform will be updated tonight.",
    "roles": ["admin", "editor"],
    "recipients": [],
    "received": [],
    "startsAt": "2026-04-10T20:00:00.000Z",
    "finishAt": "2026-04-11T02:00:00.000Z"
  }
]
```

### `POST /notifications`

Request:

```json
{
  "type": "COMMON",
  "status": "ACTIVE",
  "title": "System maintenance",
  "message": "The platform will be updated tonight.",
  "roles": ["admin", "editor"],
  "startsAt": "2026-04-10T20:00:00.000Z",
  "finishAt": "2026-04-11T02:00:00.000Z"
}
```

Response:

```json
{
  "_id": "661800000000000000000001",
  "type": "COMMON",
  "status": "ACTIVE",
  "title": "System maintenance",
  "message": "The platform will be updated tonight.",
  "roles": ["admin", "editor"],
  "recipients": [],
  "received": [],
  "startsAt": "2026-04-10T20:00:00.000Z",
  "finishAt": "2026-04-11T02:00:00.000Z"
}
```

### `POST /notifications/:notificationId/add-received/:userId`

Response:

```json
true
```

---

## 11. Therapy Requests

### `GET /therapy-requests`

Response:

```json
[
  {
    "_id": "661900000000000000000001",
    "name": "Client Request",
    "descr": "Needs weekly therapy sessions.",
    "user": "660900000000000000000020",
    "psychologist": "660900000000000000000030",
    "contacts": [
      {
        "network": "phone",
        "username": "+995555123123",
        "hidden": false
      }
    ],
    "accepted": false
  }
]
```

### `POST /therapy-requests`

Request:

```json
{
  "name": "Client Request",
  "descr": "Needs weekly therapy sessions.",
  "user": "660900000000000000000020",
  "psychologist": "660900000000000000000030",
  "contacts": [
    {
      "network": "phone",
      "username": "+995555123123",
      "hidden": false
    }
  ]
}
```

Response:

```json
{
  "_id": "661900000000000000000001",
  "name": "Client Request",
  "descr": "Needs weekly therapy sessions.",
  "user": "660900000000000000000020",
  "psychologist": "660900000000000000000030",
  "contacts": [
    {
      "network": "phone",
      "username": "+995555123123",
      "hidden": false
    }
  ],
  "accepted": false
}
```

### `POST /therapy-requests/:therapyRequestId/accept`

Response:

```json
{
  "_id": "661900000000000000000001",
  "accepted": true
}
```

### `PUT /therapy-requests/:therapyRequestId`

Request:

```json
{
  "descr": "Needs weekly therapy sessions and evening slots."
}
```

Response:

```json
{
  "_id": "661900000000000000000001",
  "name": "Client Request",
  "descr": "Needs weekly therapy sessions and evening slots.",
  "user": "660900000000000000000020",
  "psychologist": "660900000000000000000030",
  "contacts": [
    {
      "network": "phone",
      "username": "+995555123123",
      "hidden": false
    }
  ],
  "accepted": false
}
```

### `DELETE /therapy-requests/:therapyRequestId`

Response:

```json
{
  "_id": "661900000000000000000001",
  "name": "Client Request"
}
```

---

## 12. Therapy Sessions

### `GET /therapy-sessions`

Response:

```json
[
  {
    "_id": "662000000000000000000001",
    "dateTime": 1776002400000,
    "client": "660900000000000000000020",
    "psychologist": "660900000000000000000030",
    "duration": 60,
    "price": {
      "amount": 120,
      "currency": "GEL"
    },
    "commission": {
      "amount": 20,
      "currency": "GEL"
    },
    "descr": "Initial consultation"
  }
]
```

### `POST /therapy-sessions`

Request:

```json
{
  "dateTime": 1776002400000,
  "client": "660900000000000000000020",
  "psychologist": "660900000000000000000030",
  "duration": 60,
  "price": {
    "amount": 120,
    "currency": "GEL"
  },
  "commission": {
    "amount": 20,
    "currency": "GEL"
  },
  "descr": "Initial consultation"
}
```

Response:

```json
{
  "_id": "662000000000000000000001",
  "dateTime": 1776002400000,
  "client": "660900000000000000000020",
  "psychologist": "660900000000000000000030",
  "duration": 60,
  "price": {
    "amount": 120,
    "currency": "GEL"
  },
  "commission": {
    "amount": 20,
    "currency": "GEL"
  },
  "descr": "Initial consultation"
}
```

### `PUT /therapy-sessions/:sessionId`

Request:

```json
{
  "duration": 90,
  "descr": "Extended consultation"
}
```

Response:

```json
{
  "_id": "662000000000000000000001",
  "dateTime": 1776002400000,
  "client": "660900000000000000000020",
  "psychologist": "660900000000000000000030",
  "duration": 90,
  "price": {
    "amount": 120,
    "currency": "GEL"
  },
  "commission": {
    "amount": 20,
    "currency": "GEL"
  },
  "descr": "Extended consultation"
}
```

### `DELETE /therapy-sessions/:sessionId`

Response:

```json
{
  "_id": "662000000000000000000001",
  "dateTime": 1776002400000
}
```

---

## 13. Booking System: Companies

### `GET /booking-system/companies`

Response:

```json
[
  {
    "_id": "662100000000000000000001",
    "name": "DOM Center",
    "description": "Main company profile",
    "address": "12 Rustaveli Ave",
    "phone": "+995555000333",
    "email": "office@example.com",
    "website": "https://dom.example.com",
    "isActive": true,
    "settings": {
      "defaultBookingDuration": 60,
      "advanceBookingDays": 30,
      "cancellationPolicy": "24h notice",
      "timeZone": "Asia/Tbilisi"
    }
  }
]
```

### `POST /booking-system/companies`

Request:

```json
{
  "name": "Academy Space",
  "description": "Training company profile",
  "address": "24 Pekini Ave",
  "phone": "+995555000444",
  "email": "academy@example.com",
  "website": "https://academy.example.com",
  "isActive": true,
  "settings": {
    "defaultBookingDuration": 90,
    "advanceBookingDays": 14,
    "cancellationPolicy": "48h notice",
    "timeZone": "Asia/Tbilisi"
  }
}
```

Response:

```json
{
  "_id": "662100000000000000000002",
  "name": "Academy Space",
  "description": "Training company profile",
  "address": "24 Pekini Ave",
  "phone": "+995555000444",
  "email": "academy@example.com",
  "website": "https://academy.example.com",
  "isActive": true,
  "settings": {
    "defaultBookingDuration": 90,
    "advanceBookingDays": 14,
    "cancellationPolicy": "48h notice",
    "timeZone": "Asia/Tbilisi"
  }
}
```

### `PATCH /booking-system/companies/:id`

Request:

```json
{
  "isActive": false
}
```

Response:

```json
{
  "_id": "662100000000000000000002",
  "name": "Academy Space",
  "description": "Training company profile",
  "address": "24 Pekini Ave",
  "phone": "+995555000444",
  "email": "academy@example.com",
  "website": "https://academy.example.com",
  "isActive": false,
  "settings": {
    "defaultBookingDuration": 90,
    "advanceBookingDays": 14,
    "cancellationPolicy": "48h notice",
    "timeZone": "Asia/Tbilisi"
  }
}
```

---

## 14. Booking System: Rooms

### `GET /booking-system/rooms`

Response:

```json
[
  {
    "_id": "662200000000000000000001",
    "name": "Room A",
    "description": "Large training room",
    "company": "662100000000000000000001",
    "capacity": 20,
    "amenities": ["wifi", "projector"],
    "location": "Floor 2",
    "isActive": true,
    "settings": {
      "allowMultipleBookings": false,
      "minimumBookingDuration": 60,
      "maximumBookingDuration": 240,
      "cleaningTimeAfterBooking": 15,
      "advanceNoticeRequired": 60
    },
    "equipment": {
      "projector": true,
      "whiteboard": true,
      "audioSystem": false,
      "videoConferencing": true,
      "wifi": true,
      "airConditioning": true,
      "other": []
    }
  }
]
```

### `POST /booking-system/rooms`

Request:

```json
{
  "name": "Room B",
  "description": "Small consultation room",
  "company": "662100000000000000000001",
  "capacity": 6,
  "amenities": ["wifi"],
  "location": "Floor 1",
  "isActive": true,
  "settings": {
    "allowMultipleBookings": false,
    "minimumBookingDuration": 60,
    "maximumBookingDuration": 180,
    "cleaningTimeAfterBooking": 10,
    "advanceNoticeRequired": 30
  },
  "equipment": {
    "projector": false,
    "whiteboard": true,
    "audioSystem": false,
    "videoConferencing": false,
    "wifi": true,
    "airConditioning": true,
    "other": []
  }
}
```

Response:

```json
{
  "_id": "662200000000000000000002",
  "name": "Room B",
  "description": "Small consultation room",
  "company": "662100000000000000000001",
  "capacity": 6,
  "amenities": ["wifi"],
  "location": "Floor 1",
  "isActive": true,
  "settings": {
    "allowMultipleBookings": false,
    "minimumBookingDuration": 60,
    "maximumBookingDuration": 180,
    "cleaningTimeAfterBooking": 10,
    "advanceNoticeRequired": 30
  },
  "equipment": {
    "projector": false,
    "whiteboard": true,
    "audioSystem": false,
    "videoConferencing": false,
    "wifi": true,
    "airConditioning": true,
    "other": []
  }
}
```

### `PATCH /booking-system/rooms/:id`

Request:

```json
{
  "capacity": 8
}
```

Response:

```json
{
  "_id": "662200000000000000000002",
  "name": "Room B",
  "description": "Small consultation room",
  "company": "662100000000000000000001",
  "capacity": 8,
  "amenities": ["wifi"],
  "location": "Floor 1",
  "isActive": true,
  "settings": {
    "allowMultipleBookings": false,
    "minimumBookingDuration": 60,
    "maximumBookingDuration": 180,
    "cleaningTimeAfterBooking": 10,
    "advanceNoticeRequired": 30
  },
  "equipment": {
    "projector": false,
    "whiteboard": true,
    "audioSystem": false,
    "videoConferencing": false,
    "wifi": true,
    "airConditioning": true,
    "other": []
  }
}
```

---

## 15. Booking System: Schedules

### `GET /booking-system/schedules`

Response:

```json
[
  {
    "_id": "662300000000000000000001",
    "title": "Weekday Working Hours",
    "description": "Regular opening hours",
    "type": "WORKING_HOURS",
    "room": "662200000000000000000001",
    "company": "662100000000000000000001",
    "startDate": "2026-04-01T00:00:00.000Z",
    "endDate": "2026-06-30T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "18:00",
    "daysOfWeek": [1, 2, 3, 4, 5],
    "isRecurring": true,
    "recurrencePattern": {
      "frequency": "weekly",
      "interval": 1
    },
    "timeZone": "Asia/Tbilisi",
    "isActive": true,
    "priority": 1,
    "metadata": {
      "notes": "Standard office hours",
      "color": "#0ea5e9",
      "tags": ["default"]
    }
  }
]
```

### `POST /booking-system/schedules`

Request:

```json
{
  "title": "Saturday Maintenance",
  "description": "Room unavailable for cleaning",
  "type": "MAINTENANCE",
  "room": "662200000000000000000001",
  "startDate": "2026-04-20T00:00:00.000Z",
  "endDate": "2026-04-20T00:00:00.000Z",
  "startTime": "10:00",
  "endTime": "14:00",
  "daysOfWeek": [6],
  "isRecurring": false,
  "timeZone": "Asia/Tbilisi",
  "isActive": true,
  "priority": 10,
  "metadata": {
    "notes": "Deep cleaning",
    "color": "#ef4444",
    "tags": ["maintenance"]
  }
}
```

Response:

```json
{
  "_id": "662300000000000000000002",
  "title": "Saturday Maintenance",
  "description": "Room unavailable for cleaning",
  "type": "MAINTENANCE",
  "room": "662200000000000000000001",
  "startDate": "2026-04-20T00:00:00.000Z",
  "endDate": "2026-04-20T00:00:00.000Z",
  "startTime": "10:00",
  "endTime": "14:00",
  "daysOfWeek": [6],
  "isRecurring": false,
  "timeZone": "Asia/Tbilisi",
  "isActive": true,
  "priority": 10,
  "metadata": {
    "notes": "Deep cleaning",
    "color": "#ef4444",
    "tags": ["maintenance"]
  }
}
```

### `PATCH /booking-system/schedules/:id`

Request:

```json
{
  "endTime": "15:00"
}
```

Response:

```json
{
  "_id": "662300000000000000000002",
  "title": "Saturday Maintenance",
  "description": "Room unavailable for cleaning",
  "type": "MAINTENANCE",
  "room": "662200000000000000000001",
  "startDate": "2026-04-20T00:00:00.000Z",
  "endDate": "2026-04-20T00:00:00.000Z",
  "startTime": "10:00",
  "endTime": "15:00",
  "daysOfWeek": [6],
  "isRecurring": false,
  "timeZone": "Asia/Tbilisi",
  "isActive": true,
  "priority": 10,
  "metadata": {
    "notes": "Deep cleaning",
    "color": "#ef4444",
    "tags": ["maintenance"]
  }
}
```

---

## 16. Booking System: Bookings

### `GET /booking-system/bookings`

Response:

```json
[
  {
    "_id": "662400000000000000000001",
    "title": "Team Meeting",
    "description": "Weekly sync",
    "room": "662200000000000000000001",
    "bookedBy": "660900000000000000000001",
    "startDateTime": "2026-04-15T11:00:00.000Z",
    "endDateTime": "2026-04-15T12:00:00.000Z",
    "status": "APPROVED",
    "attendees": ["660900000000000000000010"],
    "timeZone": "Asia/Tbilisi",
    "metadata": {
      "purpose": "Operations",
      "estimatedAttendees": 5,
      "isPrivate": false,
      "priority": 1
    },
    "equipmentRequests": {
      "projector": true,
      "whiteboard": true
    }
  }
]
```

### `POST /booking-system/bookings`

Request:

```json
{
  "title": "Workshop Prep",
  "description": "Room setup",
  "room": "662200000000000000000001",
  "startDateTime": "2026-04-18T09:00:00.000Z",
  "endDateTime": "2026-04-18T11:00:00.000Z",
  "attendees": ["660900000000000000000010"],
  "timeZone": "Asia/Tbilisi",
  "metadata": {
    "purpose": "Preparation",
    "contactEmail": "ops@example.com",
    "estimatedAttendees": 3,
    "isPrivate": false,
    "priority": 2
  },
  "equipmentRequests": {
    "projector": true,
    "whiteboard": true,
    "other": ["extension cords"]
  }
}
```

Response:

```json
{
  "_id": "662400000000000000000002",
  "title": "Workshop Prep",
  "description": "Room setup",
  "room": "662200000000000000000001",
  "bookedBy": "660900000000000000000001",
  "startDateTime": "2026-04-18T09:00:00.000Z",
  "endDateTime": "2026-04-18T11:00:00.000Z",
  "status": "PENDING",
  "attendees": ["660900000000000000000010"],
  "timeZone": "Asia/Tbilisi",
  "metadata": {
    "purpose": "Preparation",
    "contactEmail": "ops@example.com",
    "estimatedAttendees": 3,
    "isPrivate": false,
    "priority": 2
  },
  "equipmentRequests": {
    "projector": true,
    "whiteboard": true,
    "other": ["extension cords"]
  }
}
```

### `PATCH /booking-system/bookings/:id/approve`

Request:

```json
{}
```

Response:

```json
{
  "_id": "662400000000000000000002",
  "status": "APPROVED"
}
```

### `PATCH /booking-system/bookings/:id/cancel`

Request:

```json
{
  "reason": "Room unavailable"
}
```

Response:

```json
{
  "_id": "662400000000000000000002",
  "status": "CANCELLED",
  "cancellationReason": "Room unavailable"
}
```

### `PATCH /booking-system/bookings/:id`

Request:

```json
{
  "title": "Workshop Preparation",
  "endDateTime": "2026-04-18T11:30:00.000Z"
}
```

Response:

```json
{
  "_id": "662400000000000000000002",
  "title": "Workshop Preparation",
  "description": "Room setup",
  "room": "662200000000000000000001",
  "bookedBy": "660900000000000000000001",
  "startDateTime": "2026-04-18T09:00:00.000Z",
  "endDateTime": "2026-04-18T11:30:00.000Z",
  "status": "PENDING",
  "attendees": ["660900000000000000000010"],
  "timeZone": "Asia/Tbilisi",
  "metadata": {
    "purpose": "Preparation",
    "contactEmail": "ops@example.com",
    "estimatedAttendees": 3,
    "isPrivate": false,
    "priority": 2
  },
  "equipmentRequests": {
    "projector": true,
    "whiteboard": true,
    "other": ["extension cords"]
  }
}
```

---

## 17. Notes for Frontend Development

- The new content modules use regular REST behavior and fit generic CRUD screens well.
- `applications` is the main exception because create is public, read/update is admin/editor, and throttling applies to create.
- Legacy operational modules are less uniform than the new content modules. Build their admin forms per endpoint rather than assuming one shared CRUD abstraction.
- For admin list screens, arrays returned from `GET` endpoints are the default response shape unless the route is documented otherwise.

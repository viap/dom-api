# Route Permissions Matrix

This document is a route-by-route permissions reference for frontend and admin-panel development.

It is intended to answer:

- which routes are public
- which routes require authentication
- which roles are allowed
- which routes are suitable for public website use vs admin panel use

Related docs:

- `docs/AUTH-API.md`
- `docs/ADMIN-WEB-API.md`
- `docs/ADMIN-UI-SPEC.md`
- `docs/BOOKING-SYSTEM-API.md`

---

## 1. Legend

### Access levels

- `Public`: no JWT required
- `Auth`: any authenticated user
- `Admin`
- `Editor`
- `Psychologist`
- `Admin, Editor`: either role is allowed

### Notes

- Global auth is enabled by default via `AuthGuard`
- Public routes are explicitly marked with `@Public()`
- Role restrictions are enforced by `RolesGuard`

---

## 2. New Content Modules

## 2.1 Domains

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/domains` | Public | Public site, admin |
| `GET` | `/domains/:id` | Public | Public site, admin |
| `POST` | `/domains` | Admin | Admin only |
| `PATCH` | `/domains/:id` | Admin | Admin only |
| `DELETE` | `/domains/:id` | Admin | Admin only |

---

## 2.2 Media

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/media` | Public | Public site, admin |
| `GET` | `/media/:id` | Public | Public site, admin |
| `POST` | `/media` | Admin, Editor | Admin only |
| `PATCH` | `/media/:id` | Admin, Editor | Admin only |
| `DELETE` | `/media/:id` | Admin, Editor | Admin only |

Notes:

- public reads only expose published records

---

## 2.3 Pages

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/pages` | Public | Public site, admin |
| `GET` | `/pages/:id` | Public | Public site, admin |
| `GET` | `/pages/global/home` | Public | Public site |
| `GET` | `/pages/global/:pageSlug` | Public | Public site |
| `GET` | `/pages/domain/:domainSlug` | Public | Public site |
| `GET` | `/pages/domain/:domainSlug/home` | Public | Public site |
| `GET` | `/pages/domain/:domainSlug/:pageSlug` | Public | Public site |
| `GET` | `/pages/admin/global` | Admin, Editor | Admin only |
| `GET` | `/pages/admin/:id` | Admin, Editor | Admin only |
| `POST` | `/pages` | Admin, Editor | Admin only |
| `PATCH` | `/pages/:id` | Admin, Editor | Admin only |
| `DELETE` | `/pages/:id` | Admin, Editor | Admin only |

Notes:

- public reads only expose published records
- homepage reads are available through `/pages/global/home` and `/pages/domain/:domainSlug/home`
- global pages are read through `/pages/global/:pageSlug`
- domain pages are read through `/pages/domain/:domainSlug/:pageSlug`
- raw admin editing should use `/pages/admin/:id`

---

## 2.4 Menus

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/menus/:key` | Public | Public site |
| `GET` | `/menus/domain/:domainSlug/:key` | Public | Public site |
| `GET` | `/menus` | Admin, Editor | Admin only |
| `GET` | `/menus/:id` | Admin, Editor | Admin only |
| `POST` | `/menus` | Admin, Editor | Admin only |
| `PATCH` | `/menus/:id` | Admin, Editor | Admin only |
| `DELETE` | `/menus/:id` | Admin, Editor | Admin only |

Notes:

- public responses resolve internal links to `resolvedUrl`
- broken targets are omitted from public responses
- admin responses can include `isBrokenTarget`

---

## 2.5 Locations

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/locations` | Auth | Admin only |
| `GET` | `/locations/:id` | Auth | Admin only |
| `POST` | `/locations` | Admin, Editor | Admin only |
| `PATCH` | `/locations/:id` | Admin, Editor | Admin only |
| `DELETE` | `/locations/:id` | Admin, Editor | Admin only |

---

## 2.6 People

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/people` | Public | Public site, admin |
| `GET` | `/people/:id` | Public | Public site, admin |
| `POST` | `/people` | Admin, Editor | Admin only |
| `PATCH` | `/people/:id` | Admin, Editor | Admin only |
| `DELETE` | `/people/:id` | Admin, Editor | Admin only |

Notes:

- public reads only expose published records

---

## 2.7 Partners

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/partners` | Public | Public site, admin |
| `GET` | `/partners/:id` | Public | Public site, admin |
| `GET` | `/partners/admin` | Admin, Editor | Admin only |
| `GET` | `/partners/admin/:id` | Admin, Editor | Admin only |
| `POST` | `/partners` | Admin, Editor | Admin only |
| `PATCH` | `/partners/:id` | Admin, Editor | Admin only |
| `DELETE` | `/partners/:id` | Admin, Editor | Admin only |

Notes:

- public reads only expose published records
- partner contacts are only exposed on `/partners/admin` and `/partners/admin/:id`

---

## 2.8 Programs

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/programs` | Public | Public site, admin |
| `GET` | `/programs/:id` | Public | Public site, admin |
| `POST` | `/programs` | Admin, Editor | Admin only |
| `PATCH` | `/programs/:id` | Admin, Editor | Admin only |
| `DELETE` | `/programs/:id` | Admin, Editor | Admin only |

Notes:

- list endpoint requires `domainId`
- public reads exclude `draft`

---

## 2.9 Events

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/events` | Public | Public site, admin |
| `GET` | `/events/:id` | Public | Public site, admin |
| `POST` | `/events` | Admin, Editor | Admin only |
| `PATCH` | `/events/:id` | Admin, Editor | Admin only |
| `DELETE` | `/events/:id` | Admin, Editor | Admin only |

Notes:

- list endpoint requires `domainId`
- public reads exclude `draft`

---

## 2.10 Applications

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `POST` | `/applications` | Public | Public site |
| `GET` | `/applications` | Admin, Editor | Admin only |
| `GET` | `/applications/:id` | Admin, Editor | Admin only |
| `PATCH` | `/applications/:id` | Admin, Editor | Admin only |

Notes:

- no delete route
- public create is throttled

---

## 3. Existing Core / Operational Areas

This section is intentionally high-signal rather than exhaustive. It covers the main routes the admin UI is most likely to consume.

## 3.1 Users

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/users` | Admin, Editor | Admin only |
| `GET` | `/users/me` | Auth | User/admin |
| `GET` | `/users/:id` | Admin, Editor | Admin only |
| `POST` | `/users` | Admin, Editor | Admin only |
| `PUT` | `/users/:id` | Admin, Editor | Admin only |
| `DELETE` | `/users/:id` | Admin | Admin only |

---

## 3.2 Notifications

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/notifications` | Admin, Editor | Admin only |
| `GET` | `/notifications/users/:userId` | Admin, Editor | Admin only |
| `POST` | `/notifications` | Admin, Editor | Admin only |
| `POST` | `/notifications/:notificationId/add-received/:userId` | Admin, Editor | Admin only |

---

## 3.3 Therapy Requests

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/therapy-requests` | Admin, Editor, Psychologist | Admin / specialist |
| `GET` | `/therapy-requests/:therapyRequestId` | Admin, Editor, Psychologist | Admin / specialist |
| `GET` | `/therapy-requests/psychologist/:psychologistId` | Admin, Editor, Psychologist | Specialist / admin |
| `POST` | `/therapy-requests` | User | Public app / user area |
| `POST` | `/therapy-requests/:therapyRequestId/accept` | Admin, Editor, Psychologist | Admin / specialist |
| `POST` | `/therapy-requests/:therapyRequestId/reject` | Admin, Editor, Psychologist | Admin / specialist |
| `PUT` | `/therapy-requests/:therapyRequestId` | Admin, Editor, Psychologist | Admin / specialist |
| `DELETE` | `/therapy-requests/:therapyRequestId` | Admin, Editor, Psychologist | Admin / specialist |

Note:

- `POST /therapy-requests` is not public in the same sense as `@Public()`; it is role-gated for authenticated `user`

---

## 3.4 Therapy Sessions

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/therapy-sessions` | Admin | Admin only |
| `GET` | `/therapy-sessions/:sessionId` | Admin, Editor, Psychologist | Admin / specialist |
| `GET` | `/therapy-sessions/from/:from/to/:to` | Admin, Editor, Psychologist | Admin / specialist |
| `GET` | `/therapy-sessions/statistic/from/:from/to/:to` | Admin, Editor, Psychologist | Admin / specialist |
| `GET` | `/therapy-sessions/statistic/psychologist/:psychologistId/from/:from/to/:to` | Admin, Editor, Psychologist | Admin / specialist |
| `GET` | `/therapy-sessions/psychologist/:psychologistId` | Admin, Editor, Psychologist | Specialist / admin |
| `GET` | `/therapy-sessions/psychologist/:psychologistId/from/:from/to/:to` | Admin, Editor, Psychologist | Specialist / admin |
| `GET` | `/therapy-sessions/psychologist/:psychologistId/client/:clientId` | Admin, Editor, Psychologist | Specialist / admin |
| `POST` | `/therapy-sessions` | Admin, Editor, Psychologist | Admin / specialist |
| `POST` | `/therapy-sessions/me` | Psychologist | Specialist only |
| `PUT` | `/therapy-sessions/:sessionId` | Admin, Editor, Psychologist | Admin / specialist |
| `DELETE` | `/therapy-sessions/:sessionId` | Admin, Editor, Psychologist | Admin / specialist |

Note:

- actual access is also constrained by therapist-specific guards, not only roles

---

## 3.5 Booking System: Companies

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/booking-system/companies` | Auth | Admin / operations |
| `GET` | `/booking-system/companies/active` | Auth | Admin / operations |
| `GET` | `/booking-system/companies/:id` | Auth | Admin / operations |
| `POST` | `/booking-system/companies` | Admin | Admin only |
| `PATCH` | `/booking-system/companies/:id` | Admin | Admin only |
| `DELETE` | `/booking-system/companies/:id` | Admin | Admin only |

---

## 3.6 Booking System: Rooms

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/booking-system/rooms` | Auth | Admin / operations |
| `GET` | `/booking-system/rooms/active` | Auth | Admin / operations |
| `GET` | `/booking-system/rooms/capacity/:minCapacity/:maxCapacity?` | Auth | Admin / operations |
| `GET` | `/booking-system/rooms/by-company/:companyId` | Auth | Admin / operations |
| `GET` | `/booking-system/rooms/:id` | Auth | Admin / operations |
| `POST` | `/booking-system/rooms` | Admin | Admin only |
| `PATCH` | `/booking-system/rooms/:id` | Admin | Admin only |
| `DELETE` | `/booking-system/rooms/:id` | Admin | Admin only |

---

## 3.7 Booking System: Schedules

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/booking-system/schedules` | Auth | Admin / operations |
| `GET` | `/booking-system/schedules/working-hours/:roomId/:date` | Auth | Admin / operations |
| `GET` | `/booking-system/schedules/unavailable/:roomId/:date` | Auth | Admin / operations |
| `GET` | `/booking-system/schedules/availability/:roomId/:date` | Auth | Admin / operations |
| `GET` | `/booking-system/schedules/by-room/:roomId` | Auth | Admin / operations |
| `GET` | `/booking-system/schedules/by-company/:companyId` | Auth | Admin / operations |
| `GET` | `/booking-system/schedules/:id` | Auth | Admin / operations |
| `POST` | `/booking-system/schedules` | Admin | Admin only |
| `PATCH` | `/booking-system/schedules/:id` | Admin | Admin only |
| `DELETE` | `/booking-system/schedules/:id` | Admin | Admin only |

---

## 3.8 Booking System: Bookings

| Method | Route | Access | Intended UI |
|---|---|---|---|
| `GET` | `/booking-system/bookings` | Auth | Admin / operations |
| `GET` | `/booking-system/bookings/export` | Admin | Admin only |
| `GET` | `/booking-system/bookings/stats` | Admin | Admin only |
| `GET` | `/booking-system/bookings/pending` | Admin | Admin only |
| `GET` | `/booking-system/bookings/upcoming` | Auth | Admin / operations |
| `GET` | `/booking-system/bookings/availability/:roomId` | Auth | Admin / operations |
| `GET` | `/booking-system/bookings/by-user/:userId` | Auth | Admin / operations |
| `GET` | `/booking-system/bookings/by-room/:roomId` | Auth | Admin / operations |
| `GET` | `/booking-system/bookings/series/:bookingId` | Auth | Admin / operations |
| `GET` | `/booking-system/bookings/:id` | Auth | Admin / operations |
| `POST` | `/booking-system/bookings` | Auth | Admin / operations |
| `PATCH` | `/booking-system/bookings/:id/approve` | Admin | Admin only |
| `PATCH` | `/booking-system/bookings/:id/cancel` | Auth | Admin / operations |
| `PATCH` | `/booking-system/bookings/:id/cancel-series` | Auth | Admin / operations |
| `PATCH` | `/booking-system/bookings/bulk-approve` | Admin | Admin only |
| `PATCH` | `/booking-system/bookings/:id` | Auth | Admin / operations |
| `DELETE` | `/booking-system/bookings/:id` | Auth | Admin / operations |

Note:

- some booking routes have additional ownership/business logic beyond raw role checks

---

## 4. Recommended Frontend Interpretation

### Public website

Safe public API areas:

- `/domains`
- `/media`
- `/people`
- `/partners`
- `/programs`
- `/events`
- `POST /applications`

### Admin panel

Primary admin/editor API areas:

- all new content modules
- applications review routes
- users
- notifications
- operational modules as needed

### Specialist UI

Primarily:

- therapy requests
- therapy sessions

---

## 5. Caveats

- This matrix reflects controller-level access rules and public decorators.
- Some routes also use extra guards or ownership checks in services/guards.
- Public routes may still filter records internally, for example:
  - `media` only published
  - `people` only published
  - `partners` only published
  - `programs` no `draft`
  - `events` no `draft`

# Booking System API Documentation

This document provides comprehensive API documentation for the booking-system module, a NestJS-based room booking and scheduling system.

## Table of Contents
1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Data Models](#data-models)
4. [Companies API](#companies-api)
5. [Rooms API](#rooms-api)
6. [Schedules API](#schedules-api)
7. [Bookings API](#bookings-api)
8. [Common Query Parameters](#common-query-parameters)
9. [Error Handling](#error-handling)
10. [ID Validation](#id-validation)

## Overview

The booking-system module consists of four main components:

- **Companies**: Manage organizations and their settings
- **Rooms**: Manage bookable rooms and their configurations
- **Schedules**: Define working hours and unavailable time slots
- **Bookings**: Handle room reservations with recurring options

### Base URL
All endpoints are prefixed with `/booking-system/`

### Module Structure
```
src/booking-system/
├── companies/           # Company management
├── rooms/              # Room management
├── schedules/          # Working hours & unavailable times
├── bookings/           # Booking management
└── shared/             # Common utilities and types
```

## Authentication & Authorization

### JWT Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Role-Based Access Control
- **Admin**: Full access to all operations
- **User**: Limited access based on data ownership

### Security Decorators
- `@Roles(Role.Admin)`: Admin-only endpoints
- `@IsMyBooking()`: Users can only access their own bookings

## Data Models

### Booking Status Enum
```typescript
enum BookingStatus {
  PENDING = 'pending',     // Awaiting approval
  CONFIRMED = 'confirmed', // Approved and active
  CANCELED = 'canceled'    // Canceled booking
}
```

### Recurrence Type Enum
```typescript
enum RecurrenceType {
  NONE = 'none',       // Single occurrence
  DAILY = 'daily',     // Daily recurrence
  WEEKLY = 'weekly',   // Weekly recurrence
  MONTHLY = 'monthly', // Monthly recurrence
  YEARLY = 'yearly'    // Yearly recurrence
}
```

### Company Schema
```typescript
{
  _id: ObjectId,
  name: string,
  description?: string,
  address: string,
  phone?: string,
  email?: string,
  website?: string,
  isActive: boolean,
  settings: {
    defaultBookingDuration?: number,
    advanceBookingDays?: number,
    cancellationPolicy?: string,
    timeZone?: string
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Room Schema
```typescript
{
  _id: ObjectId,
  name: string,
  description?: string,
  company: ObjectId, // Company reference
  capacity: number,
  amenities: string[],
  location?: string,
  isActive: boolean,
  allowedRoles: Role[],
  settings: {
    allowMultipleBookings?: boolean,
    minimumBookingDuration?: number,
    maximumBookingDuration?: number,
    cleaningTimeAfterBooking?: number,
    advanceNoticeRequired?: number
  },
  equipment: {
    projector?: boolean,
    whiteboard?: boolean,
    audioSystem?: boolean,
    videoConferencing?: boolean,
    wifi?: boolean,
    airConditioning?: boolean,
    other?: string[]
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Booking Schema
```typescript
{
  _id: ObjectId,
  title: string,
  description?: string,
  room: ObjectId, // Room reference
  bookedBy: ObjectId, // User reference
  startDateTime: Date,
  endDateTime: Date,
  status: BookingStatus,
  approvedBy?: ObjectId, // Admin user reference
  approvedAt?: Date,
  cancellationReason?: string,
  canceledAt?: Date,
  recurrenceType: RecurrenceType,
  parentBooking?: ObjectId, // Parent booking for recurring series
  childBookings: ObjectId[], // Child bookings in recurring series
  recurrenceEndDate?: Date,
  daysOfWeek: number[], // 0=Sunday, 1=Monday, etc.
  recurrenceInterval: number,
  attendees: string[],
  timeZone: string,
  metadata: {
    purpose?: string,
    department?: string,
    contactEmail?: string,
    contactPhone?: string,
    specialRequirements?: string,
    estimatedAttendees?: number,
    isPrivate?: boolean,
    color?: string,
    priority?: number
  },
  equipmentRequests: {
    projector?: boolean,
    microphone?: boolean,
    videoConferencing?: boolean,
    catering?: boolean,
    whiteboard?: boolean,
    flipChart?: boolean,
    other?: string[]
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Companies API

### Create Company
**POST** `/booking-system/companies`
**Roles**: Admin only

```json
{
  "name": "Tech Solutions Inc",
  "description": "Leading technology solutions provider",
  "address": "123 Tech Street, Silicon Valley, CA 94000",
  "phone": "+1-555-123-4567",
  "email": "contact@techsolutions.com",
  "website": "https://techsolutions.com",
  "settings": {
    "defaultBookingDuration": 60,
    "advanceBookingDays": 30,
    "timeZone": "America/Los_Angeles"
  }
}
```

### Get All Companies
**GET** `/booking-system/companies`

Query Parameters:
- `isActive` (string): Filter by active status ("true"/"false")
- `name` (string): Filter by name (partial match)

```bash
GET /booking-system/companies?isActive=true&name=tech
```

### Get Active Companies
**GET** `/booking-system/companies/active`

### Get Company by ID
**GET** `/booking-system/companies/:id`

### Update Company
**PATCH** `/booking-system/companies/:id`
**Roles**: Admin only

```json
{
  "name": "Tech Solutions Corporation",
  "phone": "+1-555-123-9999",
  "settings": {
    "defaultBookingDuration": 90
  }
}
```

### Delete Company
**DELETE** `/booking-system/companies/:id`
**Roles**: Admin only

## Rooms API

### Create Room
**POST** `/booking-system/rooms`
**Roles**: Admin only

```json
{
  "name": "Conference Room A",
  "description": "Large conference room with video conferencing",
  "company": "507f1f77bcf86cd799439011",
  "capacity": 12,
  "amenities": ["WiFi", "Projector", "Whiteboard"],
  "location": "2nd Floor, East Wing",
  "settings": {
    "allowMultipleBookings": false,
    "minimumBookingDuration": 30,
    "maximumBookingDuration": 480,
    "cleaningTimeAfterBooking": 15
  },
  "equipment": {
    "projector": true,
    "whiteboard": true,
    "videoConferencing": true,
    "wifi": true,
    "airConditioning": true
  }
}
```

### Get All Rooms
**GET** `/booking-system/rooms`

Query Parameters:
- `company` (string): Filter by company ID
- `isActive` (string): Filter by active status
- `name` (string): Filter by name (partial match)
- `minCapacity` (string): Minimum capacity filter
- `maxCapacity` (string): Maximum capacity filter
- `amenities` (string|string[]): Filter by amenities

```bash
GET /booking-system/rooms?company=507f1f77bcf86cd799439011&minCapacity=10&maxCapacity=20
GET /booking-system/rooms?amenities=WiFi&amenities=Projector
```

### Get Active Rooms
**GET** `/booking-system/rooms/active`

### Get Rooms by Capacity Range
**GET** `/booking-system/rooms/capacity/:minCapacity/:maxCapacity?`

```bash
GET /booking-system/rooms/capacity/10/20
GET /booking-system/rooms/capacity/5
```

### Get Rooms by Company
**GET** `/booking-system/rooms/by-company/:companyId`

### Get Room by ID
**GET** `/booking-system/rooms/:id`

### Update Room
**PATCH** `/booking-system/rooms/:id`
**Roles**: Admin only

```json
{
  "name": "Conference Room A - Updated",
  "capacity": 15,
  "amenities": ["WiFi", "Projector", "Whiteboard", "Video Conference"],
  "settings": {
    "maximumBookingDuration": 360
  }
}
```

### Delete Room
**DELETE** `/booking-system/rooms/:id`
**Roles**: Admin only

## Schedules API

### Create Schedule
**POST** `/booking-system/schedules`
**Roles**: Admin only

Working Hours Example:
```json
{
  "name": "Monday-Friday Working Hours",
  "description": "Standard business hours for Conference Room A",
  "type": "working_hours",
  "room": "507f1f77bcf86cd799439012",
  "startDate": "2024-01-01T00:00:00.000Z",
  "startTime": "09:00",
  "endTime": "17:00",
  "recurrencePattern": "weekly",
  "daysOfWeek": [1, 2, 3, 4, 5],
  "timeZone": "America/New_York"
}
```

Unavailable Time Example:
```json
{
  "name": "Christmas Holiday",
  "description": "Office closed for Christmas",
  "type": "unavailable",
  "company": "507f1f77bcf86cd799439011",
  "startDate": "2024-12-25T00:00:00.000Z",
  "endDate": "2024-12-25T23:59:59.999Z",
  "startTime": "00:00",
  "endTime": "23:59",
  "metadata": {
    "reason": "Christmas Holiday",
    "color": "#FF0000"
  }
}
```

### Get All Schedules
**GET** `/booking-system/schedules`

Query Parameters:
- `room` (string): Filter by room ID
- `company` (string): Filter by company ID
- `type` (string): Filter by schedule type
- `isActive` (string): Filter by active status
- `startDate` (string): Start date filter (YYYY-MM-DD)
- `endDate` (string): End date filter (YYYY-MM-DD)

### Get Working Hours
**GET** `/booking-system/schedules/working-hours/:roomId/:date`

```bash
GET /booking-system/schedules/working-hours/507f1f77bcf86cd799439012/2024-01-15
```

### Get Unavailable Time Slots
**GET** `/booking-system/schedules/unavailable/:roomId/:date`

```bash
GET /booking-system/schedules/unavailable/507f1f77bcf86cd799439012/2024-01-15
```

### Check Schedule Availability
**GET** `/booking-system/schedules/availability/:roomId/:date`

Query Parameters:
- `startTime` (string): Start time in HH:MM format
- `endTime` (string): End time in HH:MM format

```bash
GET /booking-system/schedules/availability/507f1f77bcf86cd799439012/2024-01-15?startTime=10:00&endTime=11:00
```

### Get Schedules by Room
**GET** `/booking-system/schedules/by-room/:roomId`

Query Parameters:
- `startDate` (string): Start date filter
- `endDate` (string): End date filter

### Get Schedules by Company
**GET** `/booking-system/schedules/by-company/:companyId`

### Get Schedule by ID
**GET** `/booking-system/schedules/:id`

### Update Schedule
**PATCH** `/booking-system/schedules/:id`
**Roles**: Admin only

```json
{
  "name": "Updated Working Hours",
  "startTime": "08:00",
  "endTime": "18:00",
  "metadata": {
    "reason": "Extended hours during busy season"
  }
}
```

### Delete Schedule
**DELETE** `/booking-system/schedules/:id`
**Roles**: Admin only

## Bookings API

### Create Booking
**POST** `/booking-system/bookings`

Single Booking Example:
```json
{
  "title": "Team Meeting",
  "description": "Weekly team sync meeting",
  "room": "507f1f77bcf86cd799439012",
  "bookedBy": "507f1f77bcf86cd799439014",
  "startDateTime": "2024-02-15T10:00:00.000Z",
  "endDateTime": "2024-02-15T11:00:00.000Z",
  "attendees": ["john@example.com", "jane@example.com"],
  "metadata": {
    "purpose": "Team synchronization",
    "department": "Engineering",
    "estimatedAttendees": 8
  },
  "equipmentRequests": {
    "projector": true,
    "videoConferencing": true
  }
}
```

Recurring Booking Example:
```json
{
  "title": "Weekly Team Meeting",
  "room": "507f1f77bcf86cd799439012",
  "bookedBy": "507f1f77bcf86cd799439014",
  "startDateTime": "2024-02-15T10:00:00.000Z",
  "endDateTime": "2024-02-15T11:00:00.000Z",
  "recurrenceType": "weekly",
  "daysOfWeek": [4],
  "recurrenceEndDate": "2024-05-15T10:00:00.000Z"
}
```

**Note**: If `bookedBy` is not provided, it defaults to the current user. Only admins can create bookings for other users.

### Get All Bookings
**GET** `/booking-system/bookings`

Query Parameters:
- `room` (string): Filter by room ID
- `bookedBy` (string): Filter by user ID
- `status` (BookingStatus): Filter by status
- `startDate` (string): Start date filter
- `endDate` (string): End date filter
- `includeChildBookings` (string): Include recurring children
- `sortBy` (string): Sort field ("created" or "startDateTime")
- `sortOrder` (string): Sort order ("asc" or "desc")
- `limit` (string): Limit results

```bash
GET /booking-system/bookings?room=507f1f77bcf86cd799439012&status=confirmed
GET /booking-system/bookings?startDate=2024-02-01&endDate=2024-02-28&bookedBy=507f1f77bcf86cd799439014
```

### Export Bookings
**GET** `/booking-system/bookings/export`
**Roles**: Admin only

Query Parameters:
- `startDate` (string): Start date for export
- `endDate` (string): End date for export
- `roomIds` (string): Comma-separated room IDs

```bash
GET /booking-system/bookings/export?startDate=2024-02-01&endDate=2024-02-28&roomIds=507f1f77bcf86cd799439012,507f1f77bcf86cd799439013
```

### Get Booking Statistics
**GET** `/booking-system/bookings/stats`
**Roles**: Admin only

Query Parameters:
- `startDate` (string): Start date for statistics
- `endDate` (string): End date for statistics

### Get Pending Bookings
**GET** `/booking-system/bookings/pending`
**Roles**: Admin only

Returns all bookings awaiting admin approval.

### Get Upcoming Bookings
**GET** `/booking-system/bookings/upcoming`

Query Parameters:
- `userId` (string): Filter by user ID
- `limit` (string): Number of bookings to return (default: 10)
- `days` (string): Number of days ahead to look

### Check Availability
**GET** `/booking-system/bookings/availability/:roomId`

Query Parameters:
- `startDateTime` (string): Start date/time (ISO format)
- `endDateTime` (string): End date/time (ISO format)
- `excludeBookingId` (string): Booking ID to exclude from check

```bash
GET /booking-system/bookings/availability/507f1f77bcf86cd799439012?startDateTime=2024-02-15T10:00:00.000Z&endDateTime=2024-02-15T11:00:00.000Z
```

### Get Bookings by User
**GET** `/booking-system/bookings/by-user/:userId`
**Security**: @IsMyBooking() - users can only access their own bookings

Query Parameters:
- `status` (BookingStatus): Filter by status

### Get Bookings by Room
**GET** `/booking-system/bookings/by-room/:roomId`

Query Parameters:
- `startDate` (string): Start date filter
- `endDate` (string): End date filter

### Get Recurring Booking Series
**GET** `/booking-system/bookings/series/:bookingId`

Returns all bookings in a recurring series given the parent booking ID.

### Get Booking by ID
**GET** `/booking-system/bookings/:id`

### Approve Booking
**PATCH** `/booking-system/bookings/:id/approve`
**Roles**: Admin only

Changes booking status from "pending" to "confirmed".

### Cancel Booking
**PATCH** `/booking-system/bookings/:id/cancel`
**Security**: @IsMyBooking() - users can only cancel their own bookings

```json
{
  "reason": "Meeting canceled due to conflicting priorities"
}
```

### Cancel Recurring Series
**PATCH** `/booking-system/bookings/:id/cancel-series`
**Security**: @IsMyBooking() - users can only cancel their own bookings

```json
{
  "reason": "Project canceled"
}
```

Cancels all future bookings in a recurring series.

### Bulk Approve Bookings
**PATCH** `/booking-system/bookings/bulk-approve`
**Roles**: Admin only

```json
{
  "bookingIds": ["507f1f77bcf86cd799439015", "507f1f77bcf86cd799439016"]
}
```

### Update Booking
**PATCH** `/booking-system/bookings/:id`
**Security**: @IsMyBooking() - users can only update their own bookings

```json
{
  "title": "Updated Team Meeting",
  "description": "Weekly team sync with additional agenda items",
  "attendees": ["john@example.com", "jane@example.com", "bob@example.com"],
  "metadata": {
    "estimatedAttendees": 10
  }
}
```

### Delete Booking
**DELETE** `/booking-system/bookings/:id`
**Security**: @IsMyBooking() - users can only delete their own bookings

Returns HTTP 204 No Content on success.

## Common Query Parameters

### Date Filtering
- Use ISO 8601 format for dates: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Date-only queries use `YYYY-MM-DD` format
- All times are handled in the specified timezone (default: UTC)

### Pagination and Sorting
- `limit`: Number of results to return
- `sortBy`: Field to sort by (varies by endpoint)
- `sortOrder`: "asc" or "desc"

### Filtering
- Boolean values: Use strings "true" or "false"
- Array parameters: Can be passed multiple times or as comma-separated values
- String matching: Usually partial/contains matching unless specified

## Error Handling

## ID Validation

All booking-system fields that reference Mongo entities (for example `room`, `company`, `bookedBy`, `approvedBy`, `parentBooking`) must be valid 24-character hex ObjectIds.

Invalid ObjectId values are rejected by Joi validation with `400 Bad Request` before service-level processing.

### Common HTTP Status Codes
- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `204 No Content`: Successful DELETE request
- `400 Bad Request`: Invalid request data or validation errors
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

### Error Response Format
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Validation Errors
All request bodies are validated using Joi schemas. Validation errors return detailed information about which fields are invalid.

### Security Considerations
- All endpoints require JWT authentication
- Role-based access control enforced
- Users can only access/modify their own bookings (except admins)
- NoSQL injection protection implemented via sanitization middleware
- ObjectId validation on all ID parameters

## Usage Examples

### Complete Booking Workflow

1. **Check room availability:**
```bash
GET /booking-system/bookings/availability/507f1f77bcf86cd799439012?startDateTime=2024-02-15T10:00:00.000Z&endDateTime=2024-02-15T11:00:00.000Z
```

2. **Create booking:**
```bash
POST /booking-system/bookings
Content-Type: application/json
{
  "title": "Project Review",
  "room": "507f1f77bcf86cd799439012",
  "startDateTime": "2024-02-15T10:00:00.000Z",
  "endDateTime": "2024-02-15T11:00:00.000Z"
}
```

3. **Admin approves booking:**
```bash
PATCH /booking-system/bookings/507f1f77bcf86cd799439015/approve
```

### Setting Up Recurring Weekly Meeting

```bash
POST /booking-system/bookings
Content-Type: application/json
{
  "title": "Weekly Standup",
  "room": "507f1f77bcf86cd799439012",
  "startDateTime": "2024-02-15T09:00:00.000Z",
  "endDateTime": "2024-02-15T09:30:00.000Z",
  "recurrenceType": "weekly",
  "daysOfWeek": [1, 3, 5],
  "recurrenceEndDate": "2024-06-15T09:00:00.000Z"
}
```

This documentation provides complete coverage of all booking-system API endpoints with practical examples for integration with other projects.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NestJS-based REST API for a therapy/psychology platform called "dom-bot-api". The application manages psychologists, therapy sessions, users, and notifications with WebSocket support for real-time communication.

## Development Commands

```bash
# Development
npm run start:dev          # Start in watch mode
npm run start:debug        # Start with debug mode

# Building
npm run build             # Build the application
npm run start:prod        # Run production build

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:e2e          # Run end-to-end tests
npm run test:cov          # Run tests with coverage

# Code Quality
npm run lint              # Run ESLint with auto-fix
npm run format            # Format code with Prettier
```

## Architecture

### Core Framework
- **NestJS**: TypeScript-based Node.js framework with decorators and dependency injection
- **MongoDB**: Database with Mongoose ODM
- **JWT Authentication**: Token-based auth with role-based access control
- **WebSocket Gateway**: Real-time notifications via Socket.IO

### Authentication & Authorization
- Global AuthGuard and RolesGuard applied to all routes
- JWT tokens with 1-day expiration
- Telegram-based authentication supported
- API client authentication with name/password
- Role-based access control (User role default)

### Database Schema Architecture
All entities use Mongoose schemas with two types:
1. **Mongoose Schemas**: Data models (e.g., `user.schema.ts`, `psychologist.schema.ts`)
2. **Joi Validation Schemas**: Request validation (prefixed with `joi.`, e.g., `joi.create-user.schema.ts`)

### Key Modules

**Core Business Logic:**
- `psychologists/`: Psychologist profiles, clients, session durations, education
- `therapy-sessions/`: Individual therapy session management
- `therapy-requests/`: Therapy request handling
- `users/`: User management with contacts and roles
- `notifications/`: Notification system with WebSocket integration

**Infrastructure:**
- `auth/`: JWT authentication, Telegram auth, API client validation
- `api-clients/`: API client management for external integrations
- `events/`: WebSocket gateway for real-time communication
- `roles/`: Role-based access control with decorators and guards

### Validation Pattern
The project uses a consistent dual-schema approach:
- **Joi schemas** for request validation via custom `JoiValidationPipe`
- **Mongoose schemas** for database modeling
- Custom decorators for authorization (`@IsMyData`, `@IsMyTherapySession`)

### Configuration
- Environment variables loaded from `config/.env`
- MongoDB connection with credentials from environment
- WebSocket port configurable via `WEBSOCKET_PORT` (default: 3004)
- Application port from `PORT` environment variable

### Real-time Features
WebSocket gateway handles:
- User authentication via JWT tokens in headers
- Real-time notifications
- Socket-to-user mapping for targeted messaging
- API client tracking per socket connection

### Testing Setup
- Jest for unit testing
- Supertest for e2e testing
- Coverage reporting configured
- Test files follow `*.spec.ts` pattern

## Security

### MongoDB NoSQL Injection Prevention
The application implements comprehensive protection against NoSQL injection attacks through multiple layers:

**Global Middleware Protection:**
- `SanitizationMiddleware` - Automatically sanitizes all incoming requests (query, body, params)
- Applied to all routes via `AppModule` middleware configuration

**Validation Pipeline:**
- Enhanced `JoiValidationPipe` with built-in sanitization before schema validation
- Removes MongoDB operators (`$where`, `$ne`, `$regex`, etc.) from user input

**Service-Level Protection:**
- `validateObjectId()` - Validates MongoDB ObjectId format before database queries
- `sanitizeQueryParams()` - Sanitizes query parameters in service methods
- `validateRoles()` - Validates role arrays against injection
- `sanitizeDateRange()` - Sanitizes date range parameters

**Protected Service Methods:**
- All `findById()` calls validate ObjectId format
- Query parameter methods use `safeFindParams()` 
- Date range queries use `sanitizeDateRange()`
- Role-based queries use `validateRoles()`

**Key Security Files:**
- `src/common/utils/mongo-sanitizer.ts` - Core sanitization utilities
- `src/common/middleware/sanitization.middleware.ts` - Global request sanitizer
- Comprehensive unit tests ensure attack vector coverage

**Usage in Services:**
```typescript
// Safe ObjectId validation
const validId = validateObjectId(userId);
if (!validId) return null;

// Safe query parameters
const safeParams = safeFindParams(queryParams);
const results = await this.model.find(safeParams);

// Safe date ranges
const { from, to } = sanitizeDateRange(fromParam, toParam);
```

### Security Best Practices
1. **Never bypass validation** - All user input must go through sanitization
2. **Validate ObjectIds** - Use `validateObjectId()` for all ID parameters
3. **Sanitize query objects** - Use `safeFindParams()` for dynamic queries
4. **Test security measures** - Run security-focused unit tests regularly
5. **Monitor for bypasses** - Watch for attempts to circumvent sanitization

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
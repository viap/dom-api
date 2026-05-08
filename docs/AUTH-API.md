# Authentication API Documentation

## Overview

The dom-api authentication system provides secure JWT-based authentication with two authentication methods:
- **Telegram Authentication**: OAuth-like authentication using Telegram user data
- **User/Password Authentication**: Traditional username/password authentication

All authentication requires API client validation, providing an additional security layer.
For web sign-in, use a server-mediated route in `dom-web` so API client secrets stay server-only.

## Architecture

### Core Components

- **AuthModule**: Main authentication module with JWT configuration
- **AuthGuard**: Global guard that validates JWT tokens and populates user context
- **RolesGuard**: Role-based access control guard
- **AuthService**: Handles token generation, validation, and user authentication
- **API Client Validation**: Required for all authentication requests

### Security Features

- JWT tokens with HS256 algorithm
- 24-hour token expiration
- API client authentication layer
- Login normalization (`trim` + `lowercase` for `user.login`)
- Login lockout policy: `5` failed attempts within `15` minutes, lockout for `15` minutes (IP + normalized login)
- Role-based access control
- Structured internal auth-failure logging with request correlation IDs
- Request sanitization middleware
- Bearer token authorization

## Authentication Endpoints

### Base URL
All authentication endpoints are prefixed with `/auth`

### 1. Telegram Authentication

**Endpoint**: `POST /auth/login/telegram`

**Description**: Authenticates users via Telegram user data. Creates new users automatically if they don't exist.

**Request Body**:
```json
{
  "apiClient": {
    "name": "web-client",
    "password": "your_api_client_password"
  },
  "telegram": {
    "id": "123456789",
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe"
  }
}
```

**Response** (200 OK):
```json
{
  "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validation Rules**:
- `apiClient.name`: Required string
- `apiClient.password`: Required string
- `telegram.id`: Required string (Telegram user ID)
- `telegram.first_name`: Optional string
- `telegram.last_name`: Optional string
- `telegram.username`: Optional string

**Runtime Rules**:
- Telegram login lockout uses the same policy as user login (`5` failed attempts in `15` minutes, then `15` minute lockout).
- Lockout key for Telegram is source IP + normalized `telegram.id`.
- Locked attempts return `429 Too Many Requests` with `Retry-After` and `retryAfterSeconds`.

### 2. User/Password Authentication

**Endpoint**: `POST /auth/login/user`

**Description**: Authenticates existing users with username and password credentials.

**Request Body**:
```json
{
  "apiClient": {
    "name": "web-client", 
    "password": "your_api_client_password"
  },
  "user": {
    "login": "username",
    "password": "user_password"
  }
}
```

**Response** (200 OK):
```json
{
  "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validation Rules**:
- `apiClient.name`: Required string
- `apiClient.password`: Required string  
- `user.login`: Required string
- `user.password`: Required string

**Runtime Rules**:
- `user.login` is normalized with `trim` + `lowercase` before credential lookup.
- External error response for invalid credentials/client remains generic (`401 Unauthorized`).
- Internal failure reasons are logged for operators (`invalid_api_client`, `invalid_user_credentials`).
- Repeated failures are rate-limited by lockout policy (`5` failures / `15` minutes, lockout `15` minutes).
- Lockout semantics are explicit: the 5th failed credential is recorded and activates lockout; the 6th and later attempts are blocked during lockout.
- Locked login attempts return `429 Too Many Requests` with `Retry-After` response header and response body `{ "message": "Too many failed attempts", "retryAfterSeconds": <seconds> }`.

### 3. Token Validation

**Endpoint**: `GET /auth/check-token`

**Description**: Validates the provided JWT token. Requires valid Bearer token in headers.

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
true
```

### 4. Health Check

**Endpoint**: `GET /auth/ping`

**Description**: Public endpoint to check API availability.

**Response** (200 OK):
```
pong
```

## JWT Token Structure

### Token Payload
```typescript
{
  "userId": "507f1f77bcf86cd799439011",
  "roles": ["user", "tenant"],
  "clientName": "web-client",
  "iat": 1640995200,
  "exp": 1641081600
}
```

### Token Configuration
- **Algorithm**: HS256
- **Expiration**: 24 hours (1d)
- **Secret**: Minimum 32 characters (configured via `JWT_SECRET`)

## Authorization

### Protected Endpoints
All endpoints except those marked with `@Public()` decorator require authentication:

**Headers**:
```
Authorization: Bearer <jwt_token>
```

### Public Endpoints
- `POST /auth/login/telegram`
- `POST /auth/login/user`
- `GET /auth/ping`

### User Context
Authenticated requests automatically populate the `user` object in the request context with full user details.

## Role-Based Access Control

### Available Roles
```typescript
enum Role {
  User = 'user',
  Admin = 'admin', 
  Editor = 'editor',
  Psychologist = 'psychologist',
  Accountant = 'accountant',
  Tenant = 'tenant',
  CommunityMember = 'community_member'
}
```

### Role-Protected Endpoints
Use the `@Role()` decorator to restrict access:
```typescript
@Role(Role.Admin)
@Get('admin-only')
adminOnlyEndpoint() { ... }
```

## API Client Configuration

### Pre-configured Clients
The system supports multiple API clients with name/password authentication:

1. **Bot Client**: For Telegram bot integration
   - Environment: `BOT_CLIENT_NAME`, `BOT_CLIENT_PASSWORD`

2. **Web Client**: For web application integration  
   - Environment: `WEB_CLIENT_NAME`, `WEB_CLIENT_PASSWORD`

### Client Validation
All authentication requests must include valid API client credentials in the `apiClient` object.

## Environment Variables

### Required Variables

```bash
# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_minimum_32_chars

# API Clients
BOT_CLIENT_NAME=bot-client
BOT_CLIENT_PASSWORD=secure_bot_password
WEB_CLIENT_NAME=web-client  
WEB_CLIENT_PASSWORD=secure_web_password

# Database
MONGO_URL=mongodb://localhost:27017
MONGO_DBNAME=dom_api
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password

# Server
PORT=3001
WEBSOCKET_PORT=3002
```

### Security Requirements
- `JWT_SECRET` must be at least 32 characters
- Use strong, unique passwords for API clients
- Store environment variables securely

## Error Responses

## ObjectId Validation Convention

Across authenticated modules, any request field that represents a Mongo reference ID is validated as a 24-character hex ObjectId at Joi boundary and rejected with `400 Bad Request` when invalid.

### Authentication Errors

**401 Unauthorized** - Invalid credentials or token:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

For login endpoints, non-lockout failures stay generic intentionally. Internal logs record failure reason and request correlation details for operations/incident triage.

**429 Too Many Requests** - Login lockout:
```json
{
  "statusCode": 429,
  "message": "Too many failed attempts",
  "retryAfterSeconds": 120
}
```

`Retry-After` header is returned as seconds remaining in lockout.

**400 Bad Request** - Validation errors:
```json
{
  "statusCode": 400,
  "message": [
    "apiClient.name must be a string",
    "telegram.id is required"
  ],
  "error": "Bad Request"
}
```

### Common Error Scenarios
- Invalid API client credentials
- Expired or malformed JWT token
- Missing authorization header
- User not found (username/password auth)
- Invalid Telegram user data
- User locked by repeated failed login attempts

## Integration Guide

### Frontend Integration Example (Server-Mediated Login)

```typescript
// Browser/client code (dom-web) calls same-origin route.
await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    login: 'username',
    password: 'secret',
  }),
});

// Server route in dom-web injects API client credentials from server env:
// API_CLIENT_NAME, API_CLIENT_PASSWORD
// and forwards to dom-api POST /auth/login/user.
```

### Structured Auth Failure Logs (Internal)

Example structured log payload from `dom-api`:

```json
{
  "event": "auth.login.failure",
  "reason": "invalid_user_credentials",
  "requestId": "f1de2d4a-...",
  "sourceIp": "203.0.113.15",
  "clientName": "domWeb",
  "loginFingerprint": "b58e4a0f62f8f6bc",
  "locked": false
}
```

`reason` is internal-only telemetry for operations and must not be exposed in client-facing error responses.

### Axios Interceptor Setup

```typescript
// API client with automatic token handling
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL
});

// Request interceptor - add auth header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Testing

### Testing Authentication Endpoints

```bash
# Telegram login
curl -X POST http://localhost:3001/auth/login/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "apiClient": {
      "name": "web-client",
      "password": "your_password"
    },
    "telegram": {
      "id": "123456789",
      "first_name": "Test",
      "username": "testuser"
    }
  }'

# User login  
curl -X POST http://localhost:3001/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{
    "apiClient": {
      "name": "web-client", 
      "password": "your_password"
    },
    "user": {
      "login": "testuser",
      "password": "testpass"
    }
  }'

# Token validation
curl -X GET http://localhost:3001/auth/check-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Considerations

### Best Practices
1. **Token Storage**: Store JWT tokens securely (httpOnly cookies recommended for web)
2. **Token Refresh**: Implement token refresh mechanism for long-lived sessions
3. **HTTPS**: Always use HTTPS in production
4. **Environment Variables**: Never expose API client credentials in frontend code
5. **Rate Limiting**: Implement rate limiting for authentication endpoints

### Security Headers
The API includes sanitization middleware that processes all requests to prevent injection attacks.

## Troubleshooting

### Common Issues

**"JWT_SECRET environment variable is required"**
- Ensure `JWT_SECRET` is set in environment variables
- Secret must be at least 32 characters long

**"Unauthorized" on authentication**
- Verify API client credentials are correct
- Check that user exists (for username/password auth)
- Ensure request body format matches schema

**"Unauthorized" on protected endpoints**
- Verify JWT token is included in Authorization header
- Check token format: `Bearer <token>`
- Ensure token hasn't expired (24-hour limit)

**CORS Issues**
- Configure CORS settings in NestJS application
- Ensure frontend origin is whitelisted

### Debug Mode
Enable NestJS debug logging to troubleshoot authentication issues:
```bash
nest start --debug
```

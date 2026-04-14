# Dom-Bot API

A comprehensive NestJS-based REST API for a therapy/psychology platform that manages psychologists, therapy sessions, users, and real-time notifications. Built with TypeScript, MongoDB, and WebSocket support for modern therapy practice management.

## 🔧 Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens, Telegram integration, API clients
- **Real-time**: WebSocket (Socket.IO)
- **Validation**: Joi schemas + Mongoose schemas
- **Security**: NoSQL injection prevention, CORS, input sanitization
- **Testing**: Jest with unit, integration, and e2e tests

## ✨ Core Features

### 🧠 Psychology Practice Management

- **Psychologist Profiles**: Complete professional profiles with education, specializations, and session pricing
- **Client Management**: Secure client records and relationship management
- **Therapy Sessions**: Individual session tracking with statistics and analytics
- **Therapy Requests**: Request handling and approval workflow
- **Booking System**: Appointment scheduling and management

### 🔒 Security & Authentication

- **Multi-method Authentication**: JWT tokens, Telegram integration, API client authentication
- **Role-based Access Control**: User, Psychologist, Admin, Editor roles
- **NoSQL Injection Prevention**: Comprehensive input sanitization and validation
- **Request Validation**: Dual-schema validation (Joi + Mongoose)
- **CORS Protection**: Configurable cross-origin resource sharing

### 🔔 Real-time Features

- **WebSocket Gateway**: Real-time notifications and updates
- **Notification System**: Targeted messaging and event broadcasting
- **Live Session Updates**: Real-time therapy session status updates
- **Multi-client Support**: API client tracking and management

### 📊 Data Management

- **Dual Schema Architecture**: Request validation + database modeling
- **Data Sanitization**: Automatic input cleaning and security validation
- **Contact Management**: Social network integration and contact systems
- **Price Management**: Flexible pricing structures for sessions

## 🚀 Installation

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd dom-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   Create `config/.env` file with the following variables:

   ```env
   # Application
   PORT=3000
   WEBSOCKET_PORT=3004

   # Database
   MONGO_URL=mongodb://localhost:27017
   MONGO_DBNAME=dom_bot_api
   MONGO_INITDB_ROOT_USERNAME=admin
   MONGO_INITDB_ROOT_PASSWORD=password

   # JWT
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=1d
   ```

4. **Database Setup**

   Ensure MongoDB is running and accessible with the configured credentials.

5. **Start the application**
   ```bash
   npm run start:dev
   ```

## 🛠️ Development Commands

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

## 🏗️ Architecture

### Module Structure

```
src/
├── auth/                 # JWT & Telegram authentication
├── users/                # User management and profiles
├── psychologists/        # Psychologist profiles and clients
├── therapy-sessions/     # Individual session management
├── therapy-requests/     # Request handling workflow
├── notifications/        # Notification system
├── ws/                   # WebSocket gateway
├── api-clients/          # API client management
├── roles/                # Role-based access control
├── booking-system/       # Appointment scheduling
├── common/               # Shared utilities and schemas
└── joi/                  # Validation pipeline
```

### Core Design Patterns

- **Dual Schema Validation**: Joi schemas for request validation + Mongoose schemas for database modeling
- **Role-based Guards**: Decorators and guards for authorization (`@Roles`, `@IsMyData`)
- **Middleware Pipeline**: Global sanitization and authentication middleware
- **Service Layer Architecture**: Business logic separation with dependency injection

## 🔒 Security Implementation

### NoSQL Injection Prevention

The API implements comprehensive protection against NoSQL injection attacks:

- **Global Sanitization Middleware**: Automatic cleaning of all incoming requests
- **Enhanced Validation Pipeline**: Joi validation with built-in sanitization
- **Service-level Protection**: ObjectId validation and query parameter sanitization
- **Attack Vector Coverage**: Protection against `$where`, `$regex`, `$ne`, and other MongoDB operators

### Authentication Methods

1. **JWT Tokens**: Standard bearer token authentication with 1-day expiration
2. **Telegram Integration**: OAuth-style authentication via Telegram
3. **API Clients**: Name/password authentication for external services

### Authorization

- **Role Hierarchy**: User (default) → Psychologist → Editor → Admin
- **Resource Ownership**: `@IsMyData` and `@IsMyTherapySession` decorators
- **Route Protection**: Global AuthGuard and RolesGuard applied to all endpoints

## 🌐 API Overview

### Authentication Endpoints

- `POST /auth/telegram` - Authenticate via Telegram
- `POST /auth/user` - Standard user authentication

### Core Resources

- `GET /psychologists` - List all psychologists
- `GET /psychologists/me` - Get current psychologist profile
- `POST /psychologists/me/add-new-client` - Add new client
- `GET /therapy-sessions/me` - Get my therapy sessions
- `POST /therapy-requests` - Create therapy request

### Media

- Public `GET /media` supports `limit`, `offset`, `kind`, and `search`, but still returns published media only.
- `POST /media/upload` uploads a local image and creates a Media record for it.
- `POST /media` creates an external media record only. The `url` must be an absolute `http` or `https` URL.
- `GET /media/:id/content` is the only public delivery path for uploaded Media files.
- Uploaded media visibility is controlled by `isPublished`. Unpublished uploaded assets are not reachable by raw filesystem URL or by the content endpoint.
- For uploaded files, `storageKey`, `url`, `mimeType`, `sizeBytes`, `width`, and `height` are system-managed fields. Admin updates are limited to `title`, `alt`, and `isPublished`.
- Frontend and admin clients must render uploaded assets from the returned `url` field and must not construct Media URLs from `storageKey`.
- Frontend apps may proxy uploaded media delivery through their own origin, but the stored `url` field remains the canonical asset reference.
- `/uploads/media/...` is not a supported public API path and must not be used in clients, fixtures, or docs.

### Real-time WebSocket Events

- `auth-by-token` - Authenticate WebSocket connection
- `notifications/get-my` - Get user notifications
- `notifications/get-all` - Get all active notifications (API clients)
- `notifications/add-received` - Mark notification as received

## 🧪 Testing

The project uses Jest for comprehensive testing:

- **Unit Tests**: Service and utility function testing
- **Integration Tests**: Module interaction testing
- **E2E Tests**: Full application workflow testing
- **Security Tests**: NoSQL injection prevention validation

Run with coverage to ensure code quality:

```bash
npm run test:cov
```

## 📋 Development Guidelines

### Code Conventions

- Follow existing patterns for new modules
- Use dual-schema approach (Joi + Mongoose) for validation
- Implement proper error handling and logging
- Add comprehensive tests for new features

### Security Best Practices

- Never bypass input validation or sanitization
- Validate all ObjectIds using `validateObjectId()`
- Use `safeFindParams()` for dynamic database queries
- Test security measures with attack vector simulations

### Module Creation

- Follow NestJS module structure
- Include proper decorators and guards
- Implement service-controller separation
- Add Joi validation schemas for all DTOs

## 📄 License

This project is private and unlicensed.

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Ensure security measures are maintained
4. Update documentation as needed

---

Built with ❤️ using NestJS and TypeScript

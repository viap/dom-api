# AGENTS.md — dom-api coding rules

This file provides guidance for AI coding agents (Codex, etc.) working in the `dom-api` NestJS service.

For cross-service architecture, auth contracts, MongoDB schema reference, and stack rules, read the files in `../ai-context/`.

## Mandatory Rules

- **Never use `class-validator` or `class-transformer`.** This project uses Joi exclusively for request validation via the custom `JoiValidationPipe`. Never install or import these packages.
- **Every new entity requires both schemas** — a Mongoose schema (`[entity].schema.ts`) AND a Joi validation schema (`joi.[operation]-[entity].schema.ts`). Omitting either is a bug.
- **Never bypass `SanitizationMiddleware`.** Do not remove or conditionally skip it in `AppModule`. Do not strip the `sanitizeObject` call from `JoiValidationPipe`.
- **Always call `validateObjectId()` before any `.findById()` call.** Return `null` or throw `NotFoundException` when the ID is invalid.
- **Always call `safeFindParams()` before passing user-supplied objects into `.find()`.** Never pass raw request query objects directly to Mongoose.
- **Always use `@/*` path aliases** (`@/*` → `src/*`). Never write deep relative imports across directories (e.g., `../../../../common`).
- **Never expose sensitive fields.** Use `select: false` in the Mongoose `@Prop()` decorator for passwords and secrets.
- **Use `@Public()` only for truly unauthenticated routes** (e.g., login endpoints). Every other route is protected by the global `AuthGuard` by default — do not add `AuthGuard` manually to controllers.
- **Never hardcode secrets.** All configuration (JWT secret, DB credentials, ports) must come from `process.env`, loaded from `config/.env` via `ConfigModule`.
- **Do not call `sanitizeObject()` directly in service methods.** The middleware and pipe already cover it. Use the higher-level utilities (`validateObjectId`, `safeFindParams`, `sanitizeDateRange`) at the service layer.

## Do Not Do

### 1. Never pass raw params to `.find()`
```typescript
// ❌
return this.model.find(req.query).exec();

// ✓
const safeParams = safeFindParams(req.query);
return this.model.find(safeParams).exec();
```

### 2. Never wrap responses in `{ data: [...] }`
```typescript
// ❌
return { data: users, total: users.length };

// ✓
return users; // raw array
// or, if a transformer exists:
return transformUsersToDto(users);
```
There is no global response wrapper. Return raw arrays or objects. Check for a `transformXxxToDto()` utility before returning user-facing data.

### 3. Never hardcode populate paths inline — use a module-level `submodels` constant
```typescript
// ❌
return this.model.findById(id).populate('user').populate([{ path: 'clients' }]).exec();

// ✓
const submodels = ['user', { path: 'clients', populate: { path: 'user', model: 'User' } }];
return this.model.findById(id).populate(submodels).exec();
```

### 4. Never validate ObjectIds with manual regex
```typescript
// ❌
if (!/^[a-f\d]{24}$/i.test(id)) throw new BadRequestException();

// ✓
const validId = validateObjectId(id);
if (!validId) throw new NotFoundException('Invalid ID');
```

### 5. Never apply a guard that is not in the module's `providers` array
```typescript
// ❌ — guard not registered in this module → NestJS DI throws at runtime
@UseGuards(SomeUnregisteredGuard)

// ✓ — guard listed in providers: [SomeGuard] in the module definition
@UseGuards(SomeGuard)
```

### 6. Never use the default `populated = true` for internal-only fetches
```typescript
// ❌ — fetches and populates nested documents just to check existence
const entity = await this.psychologistService.getById(id);
if (!entity) throw new NotFoundException();

// ✓ — skip populate when you only need the document itself
const entity = await this.psychologistService.getById(id, false);
if (!entity) throw new NotFoundException();
```

### 7. Never add `AuthGuard` or `RolesGuard` to individual controllers
Both guards are already registered globally in `AppModule` via `APP_GUARD`. Adding them again creates duplicate guard execution.

### 8. Never emit WebSocket events via `server.emit()`
The WS gateway is **pull-based** — clients request data via socket events; the server does not push. To trigger a notification, create a `Notification` document via `NotificationsService`. The client will receive it on the next `notifications/get-my` request.

---

## Module Structure

When adding a new module, follow this layout (use `psychologists/` or `booking-system/bookings/` as reference):

```
src/[feature]/
├── [feature].module.ts
├── [feature].controller.ts
├── [feature].service.ts
├── dto/
│   ├── create-[feature].dto.ts
│   └── update-[feature].dto.ts
├── schemas/
│   ├── [feature].schema.ts              # Mongoose schema
│   ├── joi.create-[feature].schema.ts   # Joi schema for POST
│   └── joi.update-[feature].schema.ts   # Joi schema for PATCH/PUT
└── enums/
    └── [feature-status].enum.ts         # (if applicable)
```

**Module definition:**
```typescript
@Module({
  imports: [
    MongooseModule.forFeature([{ name: MyEntity.name, schema: myEntitySchema }]),
    UsersModule,  // import other modules whose services you need
  ],
  controllers: [MyEntityController],
  providers: [MyEntityService],
  exports: [MyEntityService],  // export if other modules need it
})
export class MyEntityModule {}
```

**Steps to register a new module:**
1. Create the directory structure above.
2. Define the Mongoose schema with `@Schema` / `@Prop`.
3. Create at least one Joi validation schema.
4. Register the schema with `MongooseModule.forFeature(...)`.
5. Import cross-module dependencies by adding their modules to `imports`.
6. Add the new module to the `imports` array of `AppModule`.
7. Update `CLAUDE.md` and `AGENTS.md` if the new module establishes a pattern others should follow.

---

## Authentication & Authorization

All routes are protected by the global `AuthGuard` + `RolesGuard` in `AppModule`. Never add these guards to individual controllers.

**Decorator quick reference:**

| Decorator | Import path | Purpose |
|---|---|---|
| `@Public()` | `@/auth/decorators/public.decorator` | Bypass AuthGuard for unauthenticated routes |
| `@Roles(Role.Admin)` | `@/roles/decorators/role.docorator` | Require specific roles (note: filename has typo — `docorator`) |
| `@GetUserContext()` | `@/common/user-context/user-context.decorator` | Inject `UserContext` as a param |
| `@GetUser()` | `@/common/user-context/user-context.decorator` | Inject full `UserDocument` as a param |
| `@IsMyData()` | `@/therapy-requests/decorators/is-my-data.decorator` | Mark route as owner-only for therapy requests |
| `@IsMyTherapySessions()` | `@/therapy-sessions/decorators/is-my-therapy-session.decorator` | Mark route as owner-only for therapy sessions |
| `@IsMyBooking()` | `@/booking-system/bookings/decorators/is-my-booking.decorator` | Mark route as owner-only for bookings |

**`UserContext` interface:**
```typescript
interface UserContext {
  userId: string;
  roles: Array<Role>;
  clientName?: string;
}
```

**Inject the current user in a controller — two patterns:**
```typescript
// Pattern A: param decorator (preferred for simple cases)
@Get('my-items')
getMyItems(@GetUserContext() userContext: UserContext) {
  return this.myService.findByUser(userContext.userId);
}

// Pattern B: @Request() (when you also need other request properties)
@Post()
create(@Req() req: EnhancedRequest, @Body() dto: CreateDto) {
  return this.myService.create(dto, req.userContext);
}
```

**Ownership guard mechanics:**
Ownership decorators (`@IsMyData`, `@IsMyTherapySessions`, `@IsMyBooking`) set a metadata flag. Their paired module-scoped guard reads it via `Reflector.getAllAndOverride()`. The guard checks role first (admins pass through), then verifies `userContext.userId` matches the document's owner field. Guards must be listed in the module's `providers` array and applied via `@UseGuards()` on the controller.

---

## Dual-Schema Pattern

Every entity needs exactly two schema files.

### Mongoose Schema (`schemas/[entity].schema.ts`)
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MyEntityDocument = MyEntity & Document;

@Schema({ timestamps: true })
export class MyEntity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ select: false })  // sensitive fields never serialized
  secretField: string;
}

export const myEntitySchema = SchemaFactory.createForClass(MyEntity);
myEntitySchema.index({ name: 'text' });  // indexes go here
```

### Joi Validation Schema (`schemas/joi.create-[entity].schema.ts`)
```typescript
import * as Joi from 'joi';
import { CreateMyEntityDto } from '../dto/create-my-entity.dto';

export const createMyEntitySchema = Joi.object<CreateMyEntityDto>({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Name is required',
  }),
  description: Joi.string().trim().max(500).allow('').optional(),
});
```

### Applying `JoiValidationPipe` — two valid patterns
```typescript
// Pattern A: on the @Body() parameter
@Post()
create(@Body(new JoiValidationPipe(createMyEntitySchema)) dto: CreateMyEntityDto) { … }

// Pattern B: @UsePipes on the handler
@Post()
@UsePipes(new JoiValidationPipe(createMyEntitySchema))
create(@Body() dto: CreateMyEntityDto) { … }
```

Never apply `JoiValidationPipe` globally — it must receive the specific Joi schema as an argument.

---

## Pagination

Use the utilities from `@/common/utils/pagination`:

```typescript
import { parsePaginationLimit, parsePaginationOffset } from '@/common/utils/pagination';

async getAll(limitParam: unknown, offsetParam: unknown) {
  const limit = parsePaginationLimit(limitParam);   // 1–100, default 20
  const offset = parsePaginationOffset(offsetParam); // 0+, default 0
  return this.model.find().skip(offset).limit(limit).exec();
}
```

Return raw arrays — never wrap in `{ data: [...], total: n }`.

---

## Populate Strategy

Define a module-level `submodels` constant. Pass it conditionally via an optional `populated` parameter. Use `populated = false` for internal-only fetches to avoid unnecessary DB joins.

```typescript
const submodels = [
  'user',
  {
    path: 'clients',
    populate: [{ path: 'user', model: 'User' }],
  },
];

async getById(id: string, populated = true): Promise<MyEntityDocument | null> {
  const validId = validateObjectId(id);
  if (!validId) return null;
  return this.model.findById(validId).populate(populated ? submodels : undefined).exec();
}
```

---

## Security Utilities

All utilities are in `@/common/utils/mongo-sanitizer`.

| Utility | When to use |
|---|---|
| `validateObjectId(id)` | Before every `.findById()` or any query using a user-supplied ID. Returns `string \| null`. |
| `safeFindParams(params)` | Before passing any user-supplied object to `.find()`. |
| `sanitizeDateRange(from, to)` | Before using user-supplied date range values in queries. |
| `validateRoles(roles)` | Before filtering by a user-supplied roles array. |
| `sanitizeObject(obj)` | Internal — used by middleware and pipe. Do not call in services. |

**Canonical service patterns:**
```typescript
import { validateObjectId, safeFindParams, sanitizeDateRange } from '@/common/utils/mongo-sanitizer';

async findOne(id: string): Promise<MyEntityDocument> {
  const validId = validateObjectId(id);
  if (!validId) throw new NotFoundException('Invalid ID format');
  const doc = await this.model.findById(validId).exec();
  if (!doc) throw new NotFoundException();
  return doc;
}

async findAll(rawParams: unknown, from?: unknown, to?: unknown) {
  const safeParams = safeFindParams(rawParams);
  const { from: safeFrom, to: safeTo } = sanitizeDateRange(from, to);
  const query: FilterQuery<MyEntityDocument> = {};
  if (safeFrom) query.createdAt = { $gte: safeFrom };
  return this.model.find(query).exec();
}
```

---

## File Naming Conventions

| File type | Pattern | Example |
|---|---|---|
| Module | `[entity].module.ts` | `bookings.module.ts` |
| Controller | `[entity].controller.ts` | `bookings.controller.ts` |
| Service | `[entity].service.ts` | `bookings.service.ts` |
| Mongoose schema | `[entity].schema.ts` | `booking.schema.ts` |
| Joi create schema | `joi.create-[entity].schema.ts` | `joi.create-booking.schema.ts` |
| Joi update schema | `joi.update-[entity].schema.ts` | `joi.update-booking.schema.ts` |
| DTO (create) | `create-[entity].dto.ts` | `create-booking.dto.ts` |
| DTO (update) | `update-[entity].dto.ts` | `update-booking.dto.ts` |
| Enum | `[subject].enum.ts` | `booking-status.enum.ts` |
| Guard | `[purpose].guard.ts` | `is-my-booking.guard.ts` |
| Decorator | `[purpose].decorator.ts` | `is-my-booking.decorator.ts` |
| Interceptor | `[purpose].interceptor.ts` | `timezone.interceptor.ts` |
| Middleware | `[purpose].middleware.ts` | `sanitization.middleware.ts` |
| Unit test | `[subject].spec.ts` | `bookings.service.spec.ts` |
| Interface / type | `[subject].interface.ts` | `user-context.interface.ts` |

---

## WebSocket Pattern

The Socket.IO gateway lives in `src/ws/ws.gateway.ts` on port `WEBSOCKET_PORT` (default 3004). The gateway is **pull-based** — clients request data; the server does not push.

To add a new socket event, add a `@SubscribeMessage` handler in `WsGateway` and inject required services via its constructor (also add them to `WsModule` providers/imports):

```typescript
@SubscribeMessage('my-feature/get-data')
async handleMyEvent(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { someParam: string },
): Promise<WsResponse<MyData[]>> {
  const userId = socketToUser[client.id];
  if (!userId) return { event: 'unauthorized', data: [] };
  const result = await this.myService.getForUser(userId);
  return { event: 'my-feature/data', data: result };
}
```

---

## Error Handling

- Throw NestJS HTTP exceptions from service methods: `NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`, `UnauthorizedException`.
- Centralize error message strings in enum files — never duplicate the same string in two places.
- Wrap multi-step service methods in `try/catch`. Re-throw known HTTP exceptions; wrap unknown errors:

```typescript
async create(dto: CreateMyEntityDto): Promise<MyEntityDocument> {
  try {
    // multi-step logic
  } catch (error) {
    if (error instanceof BadRequestException || error instanceof ConflictException) {
      throw error;
    }
    const message = error instanceof Error ? error.message : '';
    throw new Error(`Failed to create entity: ${message}`);
  }
}
```

- Never swallow errors with empty catch blocks.

---

## Cross-Module Dependencies

1. Confirm the source module lists the service in its `exports` array.
2. Add the source **module** (not the service file) to your module's `imports` array.
3. Inject the service via constructor DI.

```typescript
// In your module:
@Module({
  imports: [UsersModule],  // UsersModule exports UsersService
  providers: [MyService],
})
export class MyModule {}

// In your service:
@Injectable()
export class MyService {
  constructor(private usersService: UsersService) {}
}
```

---

## Testing

- Unit test files follow the `*.spec.ts` pattern alongside their subject file.
- Use Jest with `@nestjs/testing` `Test.createTestingModule()`.
- Mock Mongoose models via `{ provide: getModelToken(MyEntity.name), useValue: mockModel }`.
- Do not remove or weaken the security-focused specs in `joi.pipe.spec.ts` and `sanitization.middleware.spec.ts`.

---

## Keeping Documentation Up to Date

After completing any task, check whether your changes affect how future agents should work in this codebase. If they do, update **both** `CLAUDE.md` and `AGENTS.md` before finishing.

**Do update the docs when you:**
- Introduce a new pattern, convention, or utility that other code should follow.
- Add a new module, schema type, guard, decorator, or interceptor with a structure others should replicate.
- Change naming conventions, import rules, or security patterns.
- Deviate from an existing guideline (update the guideline to reflect the new norm).

**Do not update the docs for:**
- One-off business logic that is not a template for other code.
- Bug fixes that do not change conventions.
- Changes already covered by existing rules.

**How to add entries:** Place them in the most relevant existing section. Keep each entry to one or two bullet points. Do not create new top-level sections for a single rule.

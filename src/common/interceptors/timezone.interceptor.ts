import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnhancedRequest } from '../types/enhanced-request.interface';

const timestampFields = new Set(['createdAt', 'updatedAt']);

function applyOffset(date: Date, offset: string): string {
  const sign = offset[0] === '+' ? 1 : -1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  const offsetMs = sign * (h * 60 + m) * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  return local.toISOString().replace('Z', offset);
}

function isMongooseDocumentLike(
  value: unknown,
): value is { toJSON: () => unknown; $__?: unknown; _doc?: unknown } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { toJSON?: unknown }).toJSON === 'function' &&
    ('$__' in value || '_doc' in value)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function transformDates(data: unknown, offset: string, key?: string): unknown {
  if (key && timestampFields.has(key)) {
    const parsedDate = toValidDate(data);
    return parsedDate ? applyOffset(parsedDate, offset) : data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => transformDates(item, offset));
  }

  if (!data || typeof data !== 'object') {
    return data;
  }

  const normalizedData = isMongooseDocumentLike(data) ? data.toJSON() : data;

  if (!isPlainObject(normalizedData)) {
    return normalizedData;
  }

  return Object.fromEntries(
    Object.entries(normalizedData).map(([childKey, value]) => [
      childKey,
      transformDates(value, offset, childKey),
    ]),
  );
}

@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<EnhancedRequest>();
    const timeZone = request.user?.timeZone;

    if (!timeZone) {
      return next.handle();
    }

    return next.handle().pipe(map((data) => transformDates(data, timeZone)));
  }
}

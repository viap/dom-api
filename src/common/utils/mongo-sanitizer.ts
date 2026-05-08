import { QueryParams, SafeQueryParams } from '../types/query-params.types';
import { parseNumericValue } from './parse-numeric-value';

const OBJECT_ID_HEX_PATTERN = /^[a-f\d]{24}$/i;

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * MongoDB NoSQL Injection Prevention Utilities
 */

export type SanitizableValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | SanitizableObject
  | SanitizableArray;

export interface SanitizableObject {
  [key: string]: SanitizableValue;
}

export type SanitizableArray = Array<SanitizableValue>;

/**
 * Recursively sanitizes an object by removing MongoDB operators from user input
 */
export function sanitizeObject<T extends SanitizableValue>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T;
  }

  const proto = Object.getPrototypeOf(obj);
  if (
    typeof obj === 'object' &&
    (proto === Object.prototype || proto === null)
  ) {
    const sanitized: SanitizableObject = {};

    for (const key of Object.keys(obj as SanitizableObject)) {
      if (!key.startsWith('$') && !BLOCKED_KEYS.has(key)) {
        sanitized[key] = sanitizeObject((obj as SanitizableObject)[key]);
      }
    }

    return sanitized as T;
  }

  // For primitive types, return as-is
  return obj;
}

/**
 * Validates and sanitizes MongoDB ObjectId
 */
export function validateObjectId(id: unknown): string | null {
  if (!id || typeof id !== 'string') {
    return null;
  }

  if (!OBJECT_ID_HEX_PATTERN.test(id)) {
    return null;
  }

  return id;
}

/**
 * Sanitizes query parameters for MongoDB operations
 */
export function sanitizeQueryParams(
  params: QueryParams | null | undefined,
): SafeQueryParams {
  if (!params) {
    return {};
  }

  // First sanitize the object to remove operators
  const sanitized = sanitizeObject(params);

  // Additional validation for specific patterns
  const cleaned: SafeQueryParams = {};

  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];

    // Special handling for _id fields
    if (key === '_id' || key.endsWith('Id')) {
      const validId = validateObjectId(value);
      if (validId) {
        cleaned[key] = validId;
      }
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      cleaned[key] = value as string | number | boolean | null;
    } else if (Array.isArray(value)) {
      // Filter array to only contain primitive values
      const primitiveValues = value.filter(
        (item): item is string | number | boolean | null =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean' ||
          item === null,
      );
      if (primitiveValues.length > 0) {
        cleaned[key] = primitiveValues;
      }
    }
  }

  return cleaned;
}

/**
 * Safe wrapper for MongoDB find operations
 */
export function safeFindParams(
  params: QueryParams | null | undefined = {},
): SafeQueryParams {
  return sanitizeQueryParams(params);
}

/**
 * Validates array of role strings
 */
export function validateRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter(
    (role) =>
      typeof role === 'string' &&
      role.length > 0 &&
      role.length < 50 &&
      /^[a-zA-Z_]+$/.test(role),
  );
}

/**
 * Sanitizes date range parameters
 */
export function sanitizeDateRange(
  from?: Date | string | number | null,
  to?: Date | string | number | null,
): { from?: number; to?: number } {
  const fromVal = parseNumericValue(from, true);
  const toVal = parseNumericValue(to, true);
  return {
    from: fromVal != null && !isNaN(fromVal) ? fromVal : undefined,
    to: toVal != null && !isNaN(toVal) ? toVal : undefined,
  };
}

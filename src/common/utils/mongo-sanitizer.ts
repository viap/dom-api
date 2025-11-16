import { Types } from 'mongoose';
import { QueryParams, SafeQueryParams } from '../types/query-params.types';

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

const MONGODB_OPERATORS = [
  '$where',
  '$ne',
  '$in',
  '$nin',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$exists',
  '$regex',
  '$options',
  '$all',
  '$size',
  '$elemMatch',
  '$slice',
  '$or',
  '$and',
  '$nor',
  '$not',
  '$expr',
  '$jsonSchema',
  '$mod',
  '$text',
  '$search',
  '$language',
  '$caseSensitive',
  '$diacriticSensitive',
  '$near',
  '$nearSphere',
  '$geometry',
  '$maxDistance',
  '$center',
  '$centerSphere',
  '$box',
  '$polygon',
  '$geoIntersects',
  '$geoWithin',
];

/**
 * Recursively sanitizes an object by removing MongoDB operators from user input
 */
export function sanitizeObject(obj: SanitizableValue): SanitizableValue {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as SanitizableArray;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const sanitized: SanitizableObject = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Remove keys that start with $ (MongoDB operators)
        if (!key.startsWith('$') || !MONGODB_OPERATORS.includes(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
    }

    return sanitized;
  }

  // For primitive types, return as-is
  return obj;
}

/**
 * Validates and sanitizes MongoDB ObjectId
 */
export function validateObjectId(id: string): string | null {
  if (!id || typeof id !== 'string') {
    return null;
  }

  // Check if it's a valid ObjectId format
  if (!Types.ObjectId.isValid(id)) {
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
  const sanitized = sanitizeObject(params) as SanitizableObject;

  // Additional validation for specific patterns
  const cleaned: SafeQueryParams = {};

  for (const key in sanitized) {
    if (sanitized.hasOwnProperty(key)) {
      const value = sanitized[key];

      // Special handling for _id fields
      if (key === '_id' || key.endsWith('Id')) {
        const validId = validateObjectId(value as string);
        if (validId) {
          cleaned[key] = validId;
        }
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null ||
        value === undefined
      ) {
        cleaned[key] = value as string | number | boolean | null | undefined;
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
  const result: { from?: number; to?: number } = {
    from: undefined,
    to: undefined,
  };

  if (from) {
    const fromNum =
      from instanceof Date ? from.valueOf() : new Date(from).valueOf();
    if (!isNaN(fromNum)) {
      result.from = fromNum;
    }
  }

  if (to) {
    const toNum = to instanceof Date ? to.valueOf() : new Date(to).valueOf();
    if (!isNaN(toNum)) {
      result.to = toNum;
    }
  }

  return result;
}

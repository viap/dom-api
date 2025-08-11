import {
  sanitizeObject,
  validateObjectId,
  sanitizeQueryParams,
  safeFindParams,
  validateRoles,
  sanitizeDateRange,
  SanitizableObject,
} from './mongo-sanitizer';
import { Types } from 'mongoose';

describe('MongoDB Sanitization Utilities', () => {
  describe('sanitizeObject', () => {
    it('should remove MongoDB operators from objects', () => {
      const maliciousInput: SanitizableObject = {
        name: 'John',
        $where: 'function() { return true; }',
        $ne: null,
        roles: { $in: ['admin'] },
        age: 25,
      };

      const result = sanitizeObject(maliciousInput) as SanitizableObject;

      expect(result).toEqual({
        name: 'John',
        roles: {},
        age: 25,
      });
      expect(result.$where).toBeUndefined();
      expect(result.$ne).toBeUndefined();
    });

    it('should handle nested objects', () => {
      const maliciousInput = {
        user: {
          name: 'John',
          $or: [{ admin: true }],
        },
        query: {
          $regex: '.*',
          normal: 'value',
        },
      };

      const result = sanitizeObject(maliciousInput);

      expect(result).toEqual({
        user: {
          name: 'John',
        },
        query: {
          normal: 'value',
        },
      });
    });

    it('should handle arrays', () => {
      const maliciousInput = [
        { name: 'John', $where: 'malicious' },
        { name: 'Jane', normal: 'value' },
      ];

      const result = sanitizeObject(maliciousInput);

      expect(result).toEqual([
        { name: 'John' },
        { name: 'Jane', normal: 'value' },
      ]);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should preserve primitive values', () => {
      expect(sanitizeObject('string')).toBe('string');
      expect(sanitizeObject(123)).toBe(123);
      expect(sanitizeObject(true)).toBe(true);
    });
  });

  describe('validateObjectId', () => {
    it('should validate correct ObjectId strings', () => {
      const validId = new Types.ObjectId().toString();
      expect(validateObjectId(validId)).toBe(validId);
    });

    it('should reject invalid ObjectId strings', () => {
      expect(validateObjectId('invalid')).toBe(null);
      expect(validateObjectId('12345')).toBe(null);
      expect(validateObjectId('')).toBe(null);
    });

    it('should reject non-string inputs', () => {
      expect(validateObjectId(null)).toBe(null);
      expect(validateObjectId(undefined)).toBe(null);
      expect(validateObjectId(123 as any)).toBe(null);
      expect(validateObjectId({} as any)).toBe(null);
    });
  });

  describe('sanitizeQueryParams', () => {
    it('should sanitize and validate query parameters', () => {
      const maliciousParams = {
        _id: new Types.ObjectId().toString(),
        name: 'John',
        $where: 'malicious',
        userId: 'invalid-id',
      };

      const result = sanitizeQueryParams(maliciousParams);

      expect(result._id).toBe(maliciousParams._id);
      expect(result.name).toBe('John');
      expect(result.$where).toBeUndefined();
      expect(result.userId).toBeUndefined(); // Invalid ObjectId removed
    });

    it('should handle empty or null params', () => {
      expect(sanitizeQueryParams(null)).toEqual({});
      expect(sanitizeQueryParams(undefined)).toEqual({});
      expect(sanitizeQueryParams({})).toEqual({});
    });
  });

  describe('safeFindParams', () => {
    it('should be an alias for sanitizeQueryParams', () => {
      const params = { name: 'John', $where: 'malicious' };
      expect(safeFindParams(params)).toEqual(sanitizeQueryParams(params));
    });

    it('should handle undefined params', () => {
      expect(safeFindParams()).toEqual({});
    });
  });

  describe('validateRoles', () => {
    it('should filter valid role strings', () => {
      const roles = [
        'User',
        'Admin',
        'Psychologist',
        '',
        'x'.repeat(60),
        123,
        null,
      ];
      const result = validateRoles(roles);

      expect(result).toEqual(['User', 'Admin', 'Psychologist']);
    });

    it('should reject non-array inputs', () => {
      expect(validateRoles('not-array')).toEqual([]);
      expect(validateRoles(null)).toEqual([]);
      expect(validateRoles(undefined)).toEqual([]);
    });

    it('should reject roles with special characters', () => {
      const roles = ['User', 'Admin$', 'Role-Name', 'Role Name', 'Role123'];
      const result = validateRoles(roles);

      expect(result).toEqual(['User']); // Only letters and underscore allowed
    });
  });

  describe('sanitizeDateRange', () => {
    it('should sanitize valid date ranges', () => {
      const result = sanitizeDateRange(1000000000, 2000000000);
      expect(result).toEqual({ from: 1000000000, to: 2000000000 });
    });

    it('should handle string numbers', () => {
      const result = sanitizeDateRange('1000000000', '2000000000');
      expect(result).toEqual({ from: 1000000000, to: 2000000000 });
    });

    it('should reject invalid dates', () => {
      const result = sanitizeDateRange('invalid', -1);
      expect(result).toEqual({});
    });

    it('should handle partial ranges', () => {
      const result1 = sanitizeDateRange(1000000000, null);
      expect(result1).toEqual({ from: 1000000000 });

      const result2 = sanitizeDateRange(null, 2000000000);
      expect(result2).toEqual({ to: 2000000000 });
    });
  });

  describe('NoSQL Injection Attack Vectors', () => {
    it('should prevent $where injection', () => {
      const maliciousQuery: SanitizableObject = {
        $where: 'function() { while(true) {} }', // DoS attack
      };

      const result = sanitizeObject(maliciousQuery) as SanitizableObject;
      expect(result.$where).toBeUndefined();
    });

    it('should prevent $regex injection', () => {
      const maliciousQuery: SanitizableObject = {
        password: { $regex: '.*' }, // Password enumeration
      };

      const result = sanitizeObject(maliciousQuery) as SanitizableObject;
      expect(result.password).toEqual({});
    });

    it('should prevent operator injection in nested objects', () => {
      const maliciousQuery: SanitizableObject = {
        user: {
          $or: [{ password: null }, { admin: true }],
        },
      };

      const result = sanitizeObject(maliciousQuery) as SanitizableObject;
      expect(result.user).toEqual({});
    });

    it('should prevent injection via arrays', () => {
      const maliciousQuery: SanitizableObject = {
        roles: [
          { $ne: 'user' }, // Bypass role check
          'admin',
        ],
      };

      const result = sanitizeObject(maliciousQuery) as SanitizableObject;
      expect(result.roles).toEqual([{}, 'admin']);
    });
  });
});

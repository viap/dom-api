import { BadRequestException } from '@nestjs/common';
import * as Joi from 'joi';
import { SanitizableObject } from 'src/common/utils/mongo-sanitizer';
import { JoiValidationPipe } from './joi.pipe';

describe('JoiValidationPipe with NoSQL Injection Prevention', () => {
  let pipe: JoiValidationPipe;
  let schema: Joi.ObjectSchema;

  beforeEach(() => {
    schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().optional(),
      age: Joi.number().min(0).optional(),
    });
    pipe = new JoiValidationPipe(schema);
  });

  it('should validate and sanitize valid input', () => {
    const validInput: SanitizableObject = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    };

    const result = pipe.transform(validInput);

    expect(result).toEqual(validInput);
  });

  it('should sanitize MongoDB operators before validation', () => {
    const maliciousInput: SanitizableObject = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      $where: 'function() { return true; }',
      $ne: null,
    };

    const result = pipe.transform(maliciousInput);

    expect(result).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    });
    expect(result.$where).toBeUndefined();
    expect(result.$ne).toBeUndefined();
  });

  it('should sanitize nested MongoDB operators', () => {
    const nestedSchema = Joi.object({
      user: Joi.object({
        name: Joi.string().required(),
      }).required(),
    });
    const nestedPipe = new JoiValidationPipe(nestedSchema);

    const maliciousInput: SanitizableObject = {
      user: {
        name: 'John',
        $or: [{ admin: true }],
      },
    };

    const result = nestedPipe.transform(maliciousInput);

    expect(result).toEqual({
      user: {
        name: 'John',
      },
    });
  });

  it('should throw BadRequestException for invalid data after sanitization', () => {
    const invalidInput: SanitizableObject = {
      // Missing required 'name' field
      email: 'john@example.com',
      $where: 'malicious',
    };

    expect(() => {
      pipe.transform(invalidInput);
    }).toThrow(BadRequestException);
  });

  it('should handle array inputs with MongoDB operators', () => {
    const arraySchema = Joi.object({
      users: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
          }),
        )
        .required(),
    });
    const arrayPipe = new JoiValidationPipe(arraySchema);

    const maliciousInput: SanitizableObject = {
      users: [
        { name: 'John', $where: 'malicious' },
        { name: 'Jane', $ne: null },
      ],
    };

    const result = arrayPipe.transform(maliciousInput);

    expect(result).toEqual({
      users: [{ name: 'John' }, { name: 'Jane' }],
    });
  });

  it('should preserve validation error details', () => {
    const invalidInput: SanitizableObject = {
      name: '', // Empty string should fail required validation
      email: 'invalid-email',
      age: -5,
    };

    try {
      pipe.transform(invalidInput);
      fail('Should have thrown BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain('Validation failed:');
    }
  });
});

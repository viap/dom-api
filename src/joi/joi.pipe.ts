import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ObjectSchema } from 'joi';
import {
  SanitizableValue,
  sanitizeObject,
} from '../common/utils/mongo-sanitizer';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform<T extends SanitizableValue>(
    value: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _metadata?: ArgumentMetadata,
  ): T {
    // First sanitize the input to prevent NoSQL injection
    const sanitizedValue = sanitizeObject(value) as T;

    // Then validate with Joi schema
    const { error, value: validatedValue } = this.schema.validate(
      sanitizedValue,
      {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: false,
      },
    );
    if (error) {
      const errors = error.details.reduce<Record<string, string>>(
        (acc, detail) => {
          const field = detail.path.length ? detail.path.join('.') : '_root';
          if (!acc[field]) acc[field] = detail.message;
          return acc;
        },
        {},
      );
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors,
      });
    }

    return validatedValue as T;
  }
}

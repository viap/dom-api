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
    const { error } = this.schema.validate(sanitizedValue);
    if (error) {
      const messageDetails = Array.isArray(error.details)
        ? error.details.map((detail) => {
            return detail.message;
          })
        : [];
      throw new BadRequestException(
        `Validation failed: ${messageDetails.join(' | ')}`,
      );
    }

    return sanitizedValue;
  }
}

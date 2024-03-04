import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: any, metadata: ArgumentMetadata) {
    const { error } = this.schema.validate(value);
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
    return value;
  }
}

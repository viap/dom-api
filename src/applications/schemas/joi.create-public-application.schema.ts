import * as Joi from 'joi';
import { joiApiClientSchema } from '@/api-clients/schemas/joi.api-client.schema';
import { CreatePublicApplicationDto } from '@/applications/dto/create-public-application.dto';
import { createApplicationSchema } from '@/applications/schemas/joi.create-application.schema';

export const createPublicApplicationSchema =
  Joi.object<CreatePublicApplicationDto>({
    apiClient: joiApiClientSchema.required(),
    application: createApplicationSchema.required(),
    contactSessionToken: Joi.string()
      .pattern(/^[A-Za-z0-9_-]{32,128}$/)
      .optional(),
  });

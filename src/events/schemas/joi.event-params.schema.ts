import * as Joi from 'joi';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

export const eventDomainEventParamsSchema = Joi.object({
  domainSlug: joiSlugSchema.required(),
  eventSlug: joiSlugSchema.required(),
});

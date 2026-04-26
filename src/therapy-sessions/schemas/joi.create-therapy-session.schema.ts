import * as Joi from 'joi';
import { joiObjectId, joiObjectIdWithFallback } from '@/common/schemas/joi.object-id.schema';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';

export const joiCreateTherapySessionSchema = Joi.object({
  dateTime: Joi.number(),
  client: joiObjectId.required(),
  psychologist: joiObjectIdWithFallback('me').required(),
  duration: Joi.number().required(),
  price: joiPriceSchema.required(),
  commission: joiPriceSchema,
  descr: Joi.string(),
});

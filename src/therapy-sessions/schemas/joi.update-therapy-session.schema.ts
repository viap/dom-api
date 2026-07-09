import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';

export const joiUpdateTherapySessionSchema = Joi.object({
  dateTime: Joi.number(),
  therapyRequest: joiObjectId.allow(null).optional(),
  duration: Joi.number(),
  price: joiPriceSchema,
  commission: joiPriceSchema,
  descr: Joi.string(),
});

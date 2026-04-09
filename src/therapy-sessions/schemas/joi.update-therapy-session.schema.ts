import * as Joi from 'joi';
import { joiPriceSchema } from 'src/common/schemas/joi.price.schema';

export const joiUpdateTherapySessionSchema = Joi.object({
  dateTime: Joi.number(),
  duration: Joi.number(),
  price: joiPriceSchema,
  commission: joiPriceSchema,
  descr: Joi.string(),
});

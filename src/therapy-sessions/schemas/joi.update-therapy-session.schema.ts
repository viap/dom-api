import * as Joi from 'joi';
import { joiPriceSchema } from 'src/common/schemas/joi.price.schema';

export const joiUpdateTherapySessionSchema = Joi.object({
  date: Joi.date(),
  duration: Joi.number(),
  price: joiPriceSchema,
  comission: joiPriceSchema,
  descr: Joi.string(),
});

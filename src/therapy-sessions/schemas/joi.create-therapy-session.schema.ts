import * as Joi from 'joi';
import { joiPriceSchema } from 'src/common/schemas/joi.price.schema';

export const joiCreateTherapySessionSchema = Joi.object({
  dateTime: Joi.number(),
  client: Joi.string().required(),
  psychologist: Joi.string().required(),
  duration: Joi.number().required(),
  price: joiPriceSchema.required(),
  comission: joiPriceSchema,
  descr: Joi.string(),
});

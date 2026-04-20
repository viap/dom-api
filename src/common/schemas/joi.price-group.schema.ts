import * as Joi from 'joi';
import { joiUtcIsoDateTime } from './joi.datetime.schema';
import { joiPriceSchema } from './joi.price.schema';

export const joiPriceGroupSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).optional(),
  deadline: joiUtcIsoDateTime.optional(),
  price: joiPriceSchema.required(),
});

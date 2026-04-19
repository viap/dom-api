import * as Joi from 'joi';
import { joiPriceSchema } from './joi.price.schema';

export const joiPriceGroupSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).optional(),
  deadline: Joi.date().iso().optional(),
  price: joiPriceSchema.required(),
});

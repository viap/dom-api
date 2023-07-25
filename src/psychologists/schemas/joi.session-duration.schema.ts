import * as Joi from 'joi';
import { joiPriceSchema } from './joi.price.schema';

export const joiSessionDurationSchema = Joi.object({
  alias: Joi.string().required(),
  minutes: Joi.number().required(),
  descr: Joi.string(),
  prices: Joi.array().items(joiPriceSchema),
});

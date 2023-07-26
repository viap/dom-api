import * as Joi from 'joi';
import { Currency } from '../../psychologists/enums/currency.enum';

export const joiPriceSchema = Joi.object({
  currency: Joi.string().valid(...Object.values(Currency)),
  value: Joi.number().required(),
});
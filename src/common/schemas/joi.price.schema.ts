import * as Joi from 'joi';
import { Currencies } from '../../psychologists/enums/currencies.enum';

export const joiPriceSchema = Joi.object({
  currency: Joi.string().valid(...Object.values(Currencies)),
  value: Joi.number().required(),
});

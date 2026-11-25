import * as Joi from 'joi';

export const joiEventMediaZoom = Joi.number()
  .strict()
  .min(1)
  .max(3)
  .failover(1)
  .optional();

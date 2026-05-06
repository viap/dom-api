import * as Joi from 'joi';

export const bulkIdsSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().trim().min(1).max(24).required())
    .min(1)
    .max(100)
    .required(),
});

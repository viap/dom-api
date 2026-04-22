import * as Joi from 'joi';

export const joiObjectId = Joi.string().hex().length(24).messages({
  'string.hex': '{{#label}} must be a valid ObjectId',
  'string.length': '{{#label}} must be a valid ObjectId',
});

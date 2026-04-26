import * as Joi from 'joi';

export const joiObjectId = Joi.string().hex().length(24).messages({
  'string.hex': '{{#label}} must be a valid ObjectId',
  'string.length': '{{#label}} must be a valid ObjectId',
});

export const joiObjectIdWithFallback = (fallbackValue: String) => {
  return Joi.alternatives()
  .try(joiObjectId, Joi.string().valid(fallbackValue))
  .messages({
    'alternatives.match': '{{#label}} must be a valid ObjectId',
  });
} 

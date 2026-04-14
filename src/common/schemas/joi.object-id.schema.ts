import * as Joi from 'joi';

export const joiObjectId = Joi.string().hex().length(24);

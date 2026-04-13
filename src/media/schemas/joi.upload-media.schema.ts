import * as Joi from 'joi';

export const uploadMediaSchema = Joi.object({
  title: Joi.string().trim().max(150).optional().allow(''),
  alt: Joi.string().trim().max(300).optional().allow(''),
});

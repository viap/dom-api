import * as Joi from 'joi';

export const updateMediaSchema = Joi.object({
  title: Joi.string().trim().max(150).allow('').optional().messages({
    'string.max': 'Title cannot exceed 150 characters',
  }),

  alt: Joi.string().trim().max(300).allow('').optional().messages({
    'string.max': 'Alt text cannot exceed 300 characters',
  }),

  folder: Joi.string().trim().max(200).allow('').optional().messages({
    'string.max': 'Folder cannot exceed 200 characters',
  }),

  isPublished: Joi.boolean().optional(),
}).min(1);

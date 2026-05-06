import * as Joi from 'joi';
import { MediaKind } from '../enums/media-kind.enum';

export const createMediaSchema = Joi.object({
  kind: Joi.string()
    .valid(...Object.values(MediaKind))
    .required()
    .messages({
      'any.only': 'Invalid media kind',
      'any.required': 'Media kind is required',
    }),

  url: Joi.string()
    .trim()
    .uri({ scheme: [/https?/] })
    .max(500)
    .required()
    .messages({
      'string.uri': 'Invalid URL format',
      'string.empty': 'URL is required',
      'string.max': 'URL cannot exceed 500 characters',
    }),

  title: Joi.string().trim().max(150).allow('').optional().messages({
    'string.max': 'Title cannot exceed 150 characters',
  }),

  mimeType: Joi.string().trim().max(100).optional().messages({
    'string.max': 'MIME type cannot exceed 100 characters',
  }),

  sizeBytes: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Size must be a number',
    'number.integer': 'Size must be an integer',
    'number.min': 'Size cannot be negative',
  }),

  alt: Joi.string().trim().max(300).allow('').optional().messages({
    'string.max': 'Alt text cannot exceed 300 characters',
  }),

  folder: Joi.string().trim().max(200).allow('').optional().messages({
    'string.max': 'Folder cannot exceed 200 characters',
  }),

  width: Joi.number().integer().min(1).optional().messages({
    'number.base': 'Width must be a number',
    'number.integer': 'Width must be an integer',
    'number.min': 'Width must be greater than zero',
  }),

  height: Joi.number().integer().min(1).optional().messages({
    'number.base': 'Height must be a number',
    'number.integer': 'Height must be an integer',
    'number.min': 'Height must be greater than zero',
  }),

  isPublished: Joi.boolean().default(false).optional(),
}).required();

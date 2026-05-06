import * as Joi from 'joi';

export const createLocationSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 150 characters',
  }),

  address: Joi.string().trim().min(1).max(250).required().messages({
    'string.empty': 'Address is required',
    'string.max': 'Address cannot exceed 250 characters',
  }),

  city: Joi.string().trim().max(100).optional().messages({
    'string.max': 'City cannot exceed 100 characters',
  }),

  country: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Country cannot exceed 100 characters',
  }),

  geo: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).optional(),

  notes: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
});

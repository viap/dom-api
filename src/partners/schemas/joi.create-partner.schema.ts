import * as Joi from 'joi';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { PartnerType } from '../enums/partner-type.enum';

export const createPartnerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 150 characters',
  }),

  type: Joi.string()
    .valid(...Object.values(PartnerType))
    .required()
    .messages({
      'any.only': 'Invalid partner type',
      'any.required': 'Partner type is required',
    }),

  description: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),

  logoId: joiObjectId.optional(),

  links: Joi.array()
    .items(
      Joi.object({
        platform: Joi.string()
          .valid(...Object.values(SocialNetworks))
          .required(),
        url: Joi.string()
          .trim()
          .min(1)
          .uri({ scheme: ['http', 'https'] })
          .max(300)
          .optional(),
        value: Joi.string().trim().min(1).max(300).optional(),
      }).or('url', 'value'),
    )
    .default([]),

  contacts: Joi.array().items(joiContactSchema).default([]),

  isPublished: Joi.boolean().default(false).optional(),
});

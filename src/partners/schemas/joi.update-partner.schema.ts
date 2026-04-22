import * as Joi from 'joi';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { PartnerType } from '../enums/partner-type.enum';

export const updatePartnerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).optional().messages({
    'string.empty': 'Title cannot be empty',
    'string.max': 'Title cannot exceed 150 characters',
  }),

  type: Joi.string()
    .valid(...Object.values(PartnerType))
    .optional()
    .messages({
      'any.only': 'Invalid partner type',
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
    .optional(),

  contacts: Joi.array().items(joiContactSchema).optional(),

  isPublished: Joi.boolean().optional(),
}).min(1);

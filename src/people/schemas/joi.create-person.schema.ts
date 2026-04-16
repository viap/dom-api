import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { PersonRole } from '../enums/person-role.enum';

export const createPersonSchema = Joi.object({
  userId: joiObjectId.optional(),

  fullName: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Full name is required',
    'string.max': 'Full name cannot exceed 150 characters',
  }),

  roles: Joi.array()
    .items(
      Joi.string()
        .trim()
        .valid(...Object.values(PersonRole)),
    )
    .default([]),

  bio: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Bio cannot exceed 2000 characters',
  }),

  photoId: joiObjectId.optional(),

  contacts: Joi.array().items(joiContactSchema).default([]),

  socialLinks: Joi.array()
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

  isPublished: Joi.boolean().default(false).optional(),
});

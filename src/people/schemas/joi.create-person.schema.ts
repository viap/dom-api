import * as Joi from 'joi';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';

export const createPersonSchema = Joi.object({
  userId: Joi.string().hex().length(24).optional(),

  fullName: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Full name is required',
    'string.max': 'Full name cannot exceed 150 characters',
  }),

  roles: Joi.array().items(Joi.string().trim().min(1).max(50)).default([]),

  bio: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Bio cannot exceed 2000 characters',
  }),

  photoId: Joi.string().hex().length(24).optional(),

  contacts: Joi.array().items(joiContactSchema).default([]),

  socialLinks: Joi.array()
    .items(
      Joi.object({
        platform: Joi.string()
          .valid(...Object.values(SocialNetworks))
          .required(),
        url: Joi.string().trim().uri().max(300).required(),
      }),
    )
    .default([]),

  isPublished: Joi.boolean().default(false).optional(),
});

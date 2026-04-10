import * as Joi from 'joi';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';

export const updatePersonSchema = Joi.object({
  userId: Joi.string().hex().length(24).optional(),

  fullName: Joi.string().trim().min(1).max(150).optional().messages({
    'string.empty': 'Full name cannot be empty',
    'string.max': 'Full name cannot exceed 150 characters',
  }),

  roles: Joi.array().items(Joi.string().trim().min(1).max(50)).optional(),

  bio: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Bio cannot exceed 2000 characters',
  }),

  photoId: Joi.string().hex().length(24).optional(),

  contacts: Joi.array().items(joiContactSchema).optional(),

  socialLinks: Joi.array()
    .items(
      Joi.object({
        platform: Joi.string()
          .valid(...Object.values(SocialNetworks))
          .required(),
        url: Joi.string().trim().uri().max(300).required(),
      }),
    )
    .optional(),

  isPublished: Joi.boolean().optional(),
}).min(1);

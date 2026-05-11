import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';

const personServiceSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required(),
  prices: Joi.array().items(joiPriceSchema).min(1).max(5).required(),
}).unknown(false);

export const createPersonSchema = Joi.object({
  userId: joiObjectId.optional(),

  slug: joiSlugSchema.required().messages({
    'string.empty': 'Slug is required',
    'any.required': 'Slug is required',
  }),

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

  education: Joi.string().trim().max(2000).allow('').default('').optional(),

  experience: Joi.string().trim().max(2000).allow('').default('').optional(),

  services: Joi.array().items(personServiceSchema).max(10).default([]),

  workFormat: Joi.array()
    .items(
      Joi.string()
        .trim()
        .valid(...Object.values(WorkFormat)),
    )
    .unique()
    .default([]),

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

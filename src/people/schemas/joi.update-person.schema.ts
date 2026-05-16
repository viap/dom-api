import * as Joi from 'joi';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';
import { Languages } from '../enums/languages.enum';

const personServiceSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required(),
  prices: Joi.array().items(joiPriceSchema).min(1).max(5).required(),
}).unknown(false);

export const updatePersonSchema = Joi.object({
  userId: joiObjectId.optional(),

  slug: joiSlugSchema.optional().messages({
    'string.empty': 'Slug cannot be empty',
  }),

  fullName: Joi.string().trim().min(1).max(150).optional().messages({
    'string.empty': 'Full name cannot be empty',
    'string.max': 'Full name cannot exceed 150 characters',
  }),

  roles: Joi.array()
    .items(
      Joi.string()
        .trim()
        .valid(...Object.values(PersonRole)),
    )
    .optional(),

  bio: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Bio cannot exceed 2000 characters',
  }),

  education: Joi.string().trim().max(2000).allow('').optional(),

  experience: Joi.string().trim().max(2000).allow('').optional(),

  services: Joi.array().items(personServiceSchema).max(10).optional(),

  workFormat: Joi.array()
    .items(
      Joi.string()
        .trim()
        .valid(...Object.values(WorkFormat)),
    )
    .unique()
    .optional(),

  languages: Joi.array()
    .items(
      Joi.string()
        .trim()
        .valid(...Object.values(Languages)),
    )
    .unique()
    .min(1)
    .optional(),

  photoId: joiObjectId.optional(),

  contacts: Joi.array().items(joiContactSchema).optional(),

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
    .optional(),

  isPublished: Joi.boolean().optional(),
}).min(1);

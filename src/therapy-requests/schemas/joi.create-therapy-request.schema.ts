import * as Joi from 'joi';
import { CreateTherapyRequestDto } from '../dto/create-therapy-request.dto';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { Contact } from '@/common/schemas/contact.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';

export const joiCreateTherapyRequestSchema =
  Joi.object<CreateTherapyRequestDto>({
    name: Joi.string().required(),
    descr: Joi.string().required(),
    user: joiObjectId.optional(),
    psychologist: joiObjectId.optional(),
    contacts: Joi.array<Contact>().items(joiContactSchema).required(),
    clientGender: Joi.string().valid(
      ...Object.values(TherapyRequestClientGender),
    ),
    requestCategory: Joi.string().valid(
      ...Object.values(TherapyRequestCategory),
    ),
  });

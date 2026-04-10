import * as Joi from 'joi';
import { CreateTherapyRequestDto } from '../dto/create-therapy-request.dto';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { Contact } from '@/common/schemas/contact.schema';

export const joiCreateTherapyRequestSchema =
  Joi.object<CreateTherapyRequestDto>({
    name: Joi.string().required(),
    descr: Joi.string().required(),
    user: Joi.string(),
    psychologist: Joi.string(),
    contacts: Joi.array<Contact>().items(joiContactSchema).required(),
  });

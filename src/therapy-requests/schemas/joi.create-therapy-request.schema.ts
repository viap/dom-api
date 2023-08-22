import * as Joi from 'joi';
import { CreateTherapyRequestDto } from '../dto/create-therapy-request.dto';
import { joiContactSchema } from 'src/common/schemas/joi.contacts.schema';
import { Contact } from 'src/common/schemas/contact.schema';

export const joiCreateTherapyRequestSchema =
  Joi.object<CreateTherapyRequestDto>({
    name: Joi.string().required(),
    psychologist: Joi.string(),
    user: Joi.string(),
    descr: Joi.string(),
    contacts: Joi.array<Contact>().items(joiContactSchema).required(),
  });

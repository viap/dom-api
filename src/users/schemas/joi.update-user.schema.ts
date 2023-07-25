import * as Joi from 'joi';
import { Contact } from './contact.schema';
import { joiContactSchema } from './joi.contacts.schema';

export const joiUpdateUserSchema = Joi.object({
  name: Joi.string(),
  roles: Joi.array<string>(),
  telegramId: Joi.string(),
  descr: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

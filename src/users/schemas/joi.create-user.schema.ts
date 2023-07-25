import * as Joi from 'joi';
import { CreateUserDto } from '../dto/create-user.dto';
import { joiContactSchema } from './joi.contacts.schema';
import { Contact } from './contact.schema';

export const joiCreateUserSchema = Joi.object<CreateUserDto>({
  name: Joi.string().required(),
  roles: Joi.array<string>(),
  telegramId: Joi.string(),
  descr: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

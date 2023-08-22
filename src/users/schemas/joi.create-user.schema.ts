import * as Joi from 'joi';
import { CreateUserDto } from '../dto/create-user.dto';
import { joiContactSchema } from '../../common/schemas/joi.contacts.schema';
import { Contact } from 'src/common/schemas/contact.schema';

export const joiCreateUserSchema = Joi.object<CreateUserDto>({
  name: Joi.string().required(),
  roles: Joi.array<string>(),
  descr: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

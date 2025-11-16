import * as Joi from 'joi';

import { Contact } from 'src/common/schemas/contact.schema';
import { Role } from 'src/roles/enums/roles.enum';
import { joiContactSchema } from '../../common/schemas/joi.contacts.schema';

export const joiUpdateUserSchema = Joi.object({
  name: Joi.string(),
  login: Joi.string(),
  password: Joi.string(),
  roles: Joi.array<Role>().items(...Object.values(Role)),
  descr: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

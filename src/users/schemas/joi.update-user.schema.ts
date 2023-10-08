import * as Joi from 'joi';

import { joiContactSchema } from '../../common/schemas/joi.contacts.schema';
import { Contact } from 'src/common/schemas/contact.schema';
import { Role } from 'src/roles/enums/roles.enum';

export const joiUpdateUserSchema = Joi.object({
  name: Joi.string(),
  roles: Joi.array<Role>().items(...Object.values(Role)),
  descr: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

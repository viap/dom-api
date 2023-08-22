import * as Joi from 'joi';

import { joiContactSchema } from '../../common/schemas/joi.contacts.schema';
import { Contact } from 'src/common/schemas/contact.schema';

export const joiUpdateUserSchema = Joi.object({
  name: Joi.string(),
  roles: Joi.array<string>(),
  descr: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

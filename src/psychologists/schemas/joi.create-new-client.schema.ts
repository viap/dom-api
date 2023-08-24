import * as Joi from 'joi';
import { Contact } from 'src/common/schemas/contact.schema';
import { joiContactSchema } from 'src/common/schemas/joi.contacts.schema';
import { CreateNewClientDto } from '../dto/create-new-client.dto';

export const joiCreateNewClientSchema = Joi.object<CreateNewClientDto>({
  name: Joi.string().required(),
  descr: Joi.string(),
  therapyRequest: Joi.string(),
  contacts: Joi.array<Contact>().items(joiContactSchema),
});

import * as Joi from 'joi';
import { Contact } from '@/common/schemas/contact.schema';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { UpdateTherapyRequestDto } from '../dto/update-therapy-request.dto';

export const joiUpdateTherapyRequestSchema =
  Joi.object<UpdateTherapyRequestDto>({
    name: Joi.string(),
    descr: Joi.string(),
    user: joiObjectId.optional(),
    psychologist: joiObjectId.optional(),
    contacts: Joi.array<Contact>().items(joiContactSchema),
  });

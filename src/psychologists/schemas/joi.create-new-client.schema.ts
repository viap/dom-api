import * as Joi from 'joi';
import { CreateNewClientDto } from '../dto/create-new-client.dto';

export const joiCreateNewClientSchema = Joi.object<CreateNewClientDto>({
  name: Joi.string().required(),
  descr: Joi.string(),
});

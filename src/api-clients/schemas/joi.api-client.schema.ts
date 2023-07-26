import * as Joi from 'joi';
import { ApiClientDto } from '../dto/api-client.dto';

export const joiApiClientSchema = Joi.object<ApiClientDto>({
  name: Joi.string().required(),
  password: Joi.string().required(),
});

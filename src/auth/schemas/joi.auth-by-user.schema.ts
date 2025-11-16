import * as Joi from 'joi';
import { joiApiClientSchema } from '../../api-clients/schemas/joi.api-client.schema';
import { AuthByUserDto } from '../dto/auth-by-user.dto';

export const joiAuthByUserSchema = Joi.object<AuthByUserDto>({
  apiClient: joiApiClientSchema.required(),
  user: Joi.object({
    login: Joi.string().required(),
    password: Joi.string().required(),
  }).required(),
});

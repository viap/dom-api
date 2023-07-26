import * as Joi from 'joi';
import { AuthByTelegramDto } from '../dto/auth-by-telegram.dto';
import { joiApiClientSchema } from 'src/api-clients/schemas/joi.api-client.schema';
import { joiTelegramUserSchema } from './joi.telegram-user.schema';

export const joiAuthByTelegramSchema = Joi.object<AuthByTelegramDto>({
  apiClient: joiApiClientSchema.required(),
  telegram: joiTelegramUserSchema.required(),
});

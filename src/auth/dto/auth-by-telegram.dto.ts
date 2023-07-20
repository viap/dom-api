import * as Joi from 'joi';
import {
  ApiClientDto,
  ApiClientSchema,
} from 'src/apiClients/dto/api-client.dto';
import { TelegramUserDto, TelegramUserSchema } from './telegram.dto';

export const authByTelegramSchema = Joi.object<AuthByTelegramDto>({
  apiClient: ApiClientSchema.required(),
  telegram: TelegramUserSchema.required(),
});

export class AuthByTelegramDto {
  apiClient: ApiClientDto;
  telegram: TelegramUserDto;
}

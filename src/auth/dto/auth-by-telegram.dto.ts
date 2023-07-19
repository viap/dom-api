import * as Joi from 'joi';
import { ClientDto, ClientSchema } from 'src/clients/dto/client.dto';
import { TelegramUserDto, TelegramUserSchema } from './telegram.dto';

export const authByTelegramSchema = Joi.object<AuthByTelegramDto>({
  client: ClientSchema.required(),
  telegram: TelegramUserSchema.required(),
});

export class AuthByTelegramDto {
  client: ClientDto;
  telegram: TelegramUserDto;
}

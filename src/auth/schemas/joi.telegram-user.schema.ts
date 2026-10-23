import * as Joi from 'joi';
import { TelegramUserDto } from '../dto/telegram.dto';

export const joiTelegramUserSchema = Joi.object<TelegramUserDto>({
  id: Joi.string().max(32).required(),
  username: Joi.string().allow('').max(64),
  first_name: Joi.string().allow('').max(64).optional(),
  last_name: Joi.string().allow('').max(64).optional(),
});

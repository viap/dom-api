import * as Joi from 'joi';
import { TelegramUserDto } from '../dto/telegram.dto';

export const joiTelegramUserSchema = Joi.object<TelegramUserDto>({
  id: Joi.string().required(),
  username: Joi.string(),
  first_name: Joi.string(),
  last_name: Joi.string(),
});

import * as Joi from 'joi';
import { TelegramUserDto } from '../dto/telegram.dto';

export const joiTelegramUserSchema = Joi.object<TelegramUserDto>({
  id: Joi.string().required(),
  name: Joi.string(),
  descr: Joi.string(),
  img: Joi.string(),
});

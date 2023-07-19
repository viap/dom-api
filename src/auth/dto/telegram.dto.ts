import * as Joi from 'joi';

export const TelegramUserSchema = Joi.object<TelegramUserDto>({
  id: Joi.string().required(),
  name: Joi.string(),
  descr: Joi.string(),
  img: Joi.string(),
});

export class TelegramUserDto {
  readonly id: string;
  readonly name?: string;
  readonly descr?: string;
  readonly img?: string;
}

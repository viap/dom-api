import * as Joi from 'joi';

export const updateUserSchema = Joi.object({
  name: Joi.string().required(),
  roles: Joi.array<string>().required(),
  telegramId: Joi.string(),
  descr: Joi.string(),
  img: Joi.string(),
});

export class UpdateUserDto {
  readonly name: string;
  readonly roles: Array<string>;
  readonly telegramId?: string;
  readonly descr?: string;
  readonly img?: string;
}

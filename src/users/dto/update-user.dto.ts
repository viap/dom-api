import * as Joi from 'joi';

export class UpdateUserDto {
  readonly name?: string;
  readonly roles?: Array<string>;
  readonly telegramId?: string;
  readonly descr?: string;
  readonly contacts?: object;
}

export const updateUserSchema = Joi.object({
  name: Joi.string(),
  roles: Joi.array<string>(),
  telegramId: Joi.string(),
  descr: Joi.string(),
  contacts: Joi.object().pattern(Joi.string(), Joi.string()),
});

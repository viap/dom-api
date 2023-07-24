import * as Joi from 'joi';

export class CreateUserDto {
  readonly name: string;
  readonly roles?: Array<string>;
  readonly telegramId?: string;
  readonly descr?: string;
  readonly contacts?: object;
}

export const createUserSchema = Joi.object<CreateUserDto>({
  name: Joi.string().required(),
  roles: Joi.array<string>(),
  telegramId: Joi.string(),
  descr: Joi.string(),
  contacts: Joi.object().pattern(Joi.string(), Joi.string()),
});

import * as Joi from 'joi';

export class CreateUserDto {
  readonly name: string;
  readonly roles: Array<string>;
  readonly telegramId?: string;
  readonly descr?: string;
  readonly img?: string;
}

export const createUserSchema = Joi.object<CreateUserDto>({
  name: Joi.string().required(),
  roles: Joi.array<string>().required(),
  telegramId: Joi.string(),
  descr: Joi.string(),
  img: Joi.string(),
});

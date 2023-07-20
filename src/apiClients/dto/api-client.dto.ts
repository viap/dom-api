import * as Joi from 'joi';

export const ApiClientSchema = Joi.object<ApiClientDto>({
  name: Joi.string().required(),
  password: Joi.string().required(),
});

export class ApiClientDto {
  readonly name: string;
  readonly password: string;
}

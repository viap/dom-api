import * as Joi from 'joi';

export const ClientSchema = Joi.object<ClientDto>({
  name: Joi.string().required(),
  password: Joi.string().required(),
});

export class ClientDto {
  readonly name: string;
  readonly password: string;
}

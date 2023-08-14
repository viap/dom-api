import * as Joi from 'joi';
import { EditMyClientDto } from '../dto/edit-my-client.dto';

export const joiEditMyClientSchema = Joi.object<EditMyClientDto>({
  descr: Joi.string().required(),
});

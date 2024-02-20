import * as Joi from 'joi';
import { SocialNetworks } from '../enums/social-networks.enum';

export const joiContactSchema = Joi.object({
  network: Joi.string()
    .valid(...Object.values(SocialNetworks))
    .required(),
  username: Joi.string().required(),
  id: Joi.string(),
  hidden: Joi.boolean(),
});

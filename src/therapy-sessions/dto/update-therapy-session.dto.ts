import * as Joi from 'joi';
import {
  SessionDuration,
  sessionDurationSchema,
} from 'src/psychologists/schemas/session-duration.schema';

export class UpdateTherapySessionDto {
  date: Date;
  sessionDuration: SessionDuration;
  comission: number;
  cabinet: string;
  descr: string;
}

export const updateTherapySessionSchema = Joi.object({
  date: Joi.date().required(),
  sessionDuration: Joi.object().schema(sessionDurationSchema),
  comission: Joi.number(),
  cabinet: Joi.string(),
  descr: Joi.string(),
});

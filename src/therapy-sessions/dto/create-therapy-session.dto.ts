import * as Joi from 'joi';
import {
  SessionDuration,
  sessionDurationSchema,
} from 'src/psychologists/schemas/session-duration.schema';

export class CreateTherapySessionDto {
  date: Date;
  participant: string;
  psychologist: string;
  sessionDuration: SessionDuration;
  comission: number;
  cabinet: string;
  descr: string;
}

export const createTherapySessionSchema = Joi.object({
  date: Joi.date().required(),
  participant: Joi.string().required(),
  psychologist: Joi.string().required(),
  sessionDuration: Joi.object().schema(sessionDurationSchema),
  comission: Joi.number(),
  cabinet: Joi.string(),
  descr: Joi.string(),
});

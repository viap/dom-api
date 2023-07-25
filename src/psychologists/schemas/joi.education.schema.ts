import * as Joi from 'joi';

export const joiEducationSchema = Joi.object({
  title: Joi.string().min(1).required(),
  author: Joi.string().min(1).required(),
  hours: Joi.number().min(1),
  startDate: Joi.date(),
  endDate: Joi.date(),
});

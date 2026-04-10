import * as Joi from 'joi';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { ApplicationFormType } from '../enums/application-form-type.enum';

const payloadSchema = Joi.when('formType', {
  switch: [
    {
      is: ApplicationFormType.Partnership,
      then: Joi.object({
        organizationName: Joi.string().trim().min(1).max(150).required(),
        message: Joi.string().trim().max(1000).allow('').optional(),
      }).required(),
    },
    {
      is: ApplicationFormType.ProgramEnrollment,
      then: Joi.object({
        programId: Joi.string().hex().length(24).required(),
        message: Joi.string().trim().max(1000).allow('').optional(),
      }).required(),
    },
    {
      is: ApplicationFormType.EventRegistration,
      then: Joi.object({
        eventId: Joi.string().hex().length(24).required(),
        message: Joi.string().trim().max(1000).allow('').optional(),
      }).required(),
    },
    {
      is: ApplicationFormType.CorporateTraining,
      then: Joi.object({
        companyName: Joi.string().trim().min(1).max(150).required(),
        message: Joi.string().trim().max(1000).allow('').optional(),
      }).required(),
    },
    {
      is: ApplicationFormType.SpecialistRequest,
      then: Joi.object({
        specialization: Joi.string().trim().min(1).max(150).required(),
        message: Joi.string().trim().max(1000).allow('').optional(),
      }).required(),
    },
    {
      is: ApplicationFormType.General,
      then: Joi.object({
        message: Joi.string().trim().min(1).max(1000).required(),
      }).required(),
    },
  ],
  otherwise: Joi.object().default({}),
});

export const createApplicationSchema = Joi.object({
  domainId: Joi.string().hex().length(24).required(),

  formType: Joi.string()
    .valid(...Object.values(ApplicationFormType))
    .required(),

  source: Joi.object({
    entityType: Joi.string().valid('program', 'event', 'partner').optional(),
    entityId: Joi.string().hex().length(24).optional(),
    utm: Joi.object()
      .pattern(Joi.string().max(50), Joi.string().max(200))
      .optional(),
  }).optional(),

  applicant: Joi.object({
    name: Joi.string().trim().min(1).max(150).required(),
    contacts: Joi.array().items(joiContactSchema).min(1).required(),
  }).required(),

  payload: payloadSchema,
});

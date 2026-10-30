import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiContactSchema } from '@/common/schemas/joi.contacts.schema';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import { PreferredContactType } from '../types/preferred-contact.type';

const optionalMessageSchema = Joi.string()
  .trim()
  .max(1000)
  .allow('')
  .optional();
const requiredMessageSchema = Joi.string().trim().min(1).max(1000).required();
const legacySpecialistRequestPayloadSchema = Joi.object({
  specialization: Joi.string().trim().min(1).max(150).required(),
  personId: joiObjectId.optional(),
  message: optionalMessageSchema,
}).required();
const specialistRequestPayloadSchema = Joi.object({
  consultationFormat: Joi.string()
    .valid('online', 'in_person_tbilisi')
    .required(),
  personId: joiObjectId.optional(),
  message: optionalMessageSchema,
}).required();

const legacyPayloadSchema = Joi.when('formType', {
  switch: [
    {
      is: ApplicationFormType.Partnership,
      then: Joi.object({
        organizationName: Joi.string().trim().min(1).max(150).required(),
        message: optionalMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.ProgramEnrollment,
      then: Joi.object({
        programId: joiObjectId.required(),
        message: optionalMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.EventRegistration,
      then: Joi.object({
        eventId: joiObjectId.required(),
        message: optionalMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.CorporateTraining,
      then: Joi.object({
        companyName: Joi.string().trim().min(1).max(150).required(),
        message: optionalMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.SpecialistRequest,
      then: legacySpecialistRequestPayloadSchema,
    },
    {
      is: ApplicationFormType.General,
      then: Joi.object({
        message: requiredMessageSchema,
      }).required(),
    },
  ],
  otherwise: Joi.object().default({}),
});

const v2PayloadSchema = Joi.when('formType', {
  switch: [
    {
      is: ApplicationFormType.Partnership,
      then: Joi.object({
        organizationName: Joi.string().trim().min(1).max(150).optional(),
        message: requiredMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.ProgramEnrollment,
      then: Joi.object({
        programId: joiObjectId.required(),
        message: optionalMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.EventRegistration,
      then: Joi.object({
        eventId: joiObjectId.required(),
        message: optionalMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.CorporateTraining,
      then: Joi.object({
        companyName: Joi.string().trim().min(1).max(150).required(),
        message: requiredMessageSchema,
      }).required(),
    },
    {
      is: ApplicationFormType.SpecialistRequest,
      then: specialistRequestPayloadSchema,
    },
    {
      is: ApplicationFormType.Supervision,
      then: Joi.object({
        requestText: Joi.string().trim().min(1).max(1000).required(),
        professionalRole: Joi.string().trim().min(1).max(150).optional(),
        formatPreference: Joi.string()
          .valid('individual', 'group', 'no_preference')
          .optional(),
      }).required(),
    },
    {
      is: ApplicationFormType.General,
      then: Joi.object({
        message: requiredMessageSchema,
      }).required(),
    },
  ],
  otherwise: Joi.object().default({}),
});

const payloadSchema = Joi.when('schemaVersion', {
  is: Joi.number().valid(2, 3).required(),
  then: v2PayloadSchema,
  otherwise: legacyPayloadSchema,
});

// Public form input: same shape as other contacts, with length caps.
const applicantContactSchema = joiContactSchema.keys({
  username: Joi.string().max(200).required(),
  id: Joi.string().max(100),
});

const preferredContactSchema = Joi.alternatives().try(
  Joi.object({
    type: Joi.string().valid(PreferredContactType.TelegramUsername).required(),
    username: Joi.string()
      .pattern(/^[A-Za-z0-9_]{5,32}$/)
      .required(),
    verification: Joi.string().valid('unverified').required(),
  }),
  Joi.object({
    type: Joi.string().valid(PreferredContactType.Phone).required(),
    phoneE164: Joi.string()
      .pattern(/^\+[1-9]\d{6,14}$/)
      .required(),
    whatsappAvailable: Joi.boolean().required(),
  }),
  Joi.object({
    type: Joi.string().valid(PreferredContactType.TelegramIdentity).required(),
  }),
);

const legacyApplicantSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  contacts: Joi.array().items(applicantContactSchema).min(1).max(5).required(),
}).required();

const v3ApplicantSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  preferredContact: preferredContactSchema.required(),
}).required();

export const createApplicationSchema = Joi.object({
  schemaVersion: Joi.when('formType', {
    is: ApplicationFormType.Supervision,
    then: Joi.number().integer().valid(2, 3).required(),
    otherwise: Joi.number().integer().valid(1, 2, 3).optional(),
  }),

  domainId: joiObjectId.optional(),

  formType: Joi.string()
    .valid(...Object.values(ApplicationFormType))
    .required(),

  source: Joi.object({
    entityType: Joi.string()
      .valid('program', 'event', 'partner', 'person')
      .optional(),
    entityId: joiObjectId.optional(),
    utm: Joi.object()
      .pattern(Joi.string().max(50), Joi.string().max(200))
      .max(10)
      .optional(),
  }).optional(),

  applicant: Joi.when('schemaVersion', {
    is: Joi.number().valid(3).required(),
    then: v3ApplicantSchema,
    otherwise: legacyApplicantSchema,
  }),

  payload: payloadSchema,
});

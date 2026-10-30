import { Contact } from '@/common/schemas/contact.schema';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import { PreferredContactInput } from '../types/preferred-contact.type';

interface CreateApplicationContextDto {
  domainId?: string;
  source?: {
    entityType?: string;
    entityId?: string;
    utm?: Record<string, string>;
  };
}

interface CreateApplicationLegacyApplicantDto {
  applicant: {
    name: string;
    contacts: Array<Contact>;
  };
}

interface CreateApplicationV3ApplicantDto {
  applicant: {
    name: string;
    preferredContact: PreferredContactInput;
  };
}

export interface GeneralApplicationPayload {
  message: string;
}

export interface PartnershipV1ApplicationPayload {
  organizationName: string;
  message?: string;
}

export interface PartnershipV2ApplicationPayload {
  organizationName?: string;
  message: string;
}

export interface ProgramEnrollmentApplicationPayload {
  programId: string;
  message?: string;
}

export interface EventRegistrationApplicationPayload {
  eventId: string;
  message?: string;
}

export interface CorporateTrainingV1ApplicationPayload {
  companyName: string;
  message?: string;
}

export interface CorporateTrainingV2ApplicationPayload {
  companyName: string;
  message: string;
}

export type SpecialistConsultationFormat = 'online' | 'in_person_tbilisi';

export interface SpecialistRequestV1ApplicationPayload {
  personId?: string;
  specialization: string;
  message?: string;
}

export interface SpecialistRequestApplicationPayload {
  personId?: string;
  consultationFormat: SpecialistConsultationFormat;
  message?: string;
}

export type SupervisionFormatPreference =
  | 'individual'
  | 'group'
  | 'no_preference';

export interface SupervisionApplicationPayload {
  requestText: string;
  professionalRole?: string;
  formatPreference?: SupervisionFormatPreference;
}

type CreateApplicationV1Variant =
  | {
      formType: ApplicationFormType.General;
      payload: GeneralApplicationPayload;
    }
  | {
      formType: ApplicationFormType.Partnership;
      payload: PartnershipV1ApplicationPayload;
    }
  | {
      formType: ApplicationFormType.ProgramEnrollment;
      payload: ProgramEnrollmentApplicationPayload;
    }
  | {
      formType: ApplicationFormType.EventRegistration;
      payload: EventRegistrationApplicationPayload;
    }
  | {
      formType: ApplicationFormType.CorporateTraining;
      payload: CorporateTrainingV1ApplicationPayload;
    }
  | {
      formType: ApplicationFormType.SpecialistRequest;
      payload: SpecialistRequestV1ApplicationPayload;
    };

type CreateApplicationV2Variant =
  | {
      formType: ApplicationFormType.General;
      payload: GeneralApplicationPayload;
    }
  | {
      formType: ApplicationFormType.Partnership;
      payload: PartnershipV2ApplicationPayload;
    }
  | {
      formType: ApplicationFormType.ProgramEnrollment;
      payload: ProgramEnrollmentApplicationPayload;
    }
  | {
      formType: ApplicationFormType.EventRegistration;
      payload: EventRegistrationApplicationPayload;
    }
  | {
      formType: ApplicationFormType.CorporateTraining;
      payload: CorporateTrainingV2ApplicationPayload;
    }
  | {
      formType: ApplicationFormType.SpecialistRequest;
      payload: SpecialistRequestApplicationPayload;
    }
  | {
      formType: ApplicationFormType.Supervision;
      payload: SupervisionApplicationPayload;
    };

export type CreateApplicationV1Dto = CreateApplicationContextDto &
  CreateApplicationLegacyApplicantDto &
  CreateApplicationV1Variant & {
    schemaVersion?: 1;
  };

export type CreateApplicationV2Dto = CreateApplicationContextDto &
  CreateApplicationLegacyApplicantDto &
  CreateApplicationV2Variant & {
    schemaVersion: 2;
  };

export type CreateApplicationV3Dto = CreateApplicationContextDto &
  CreateApplicationV3ApplicantDto &
  CreateApplicationV2Variant & {
    schemaVersion: 3;
  };

export type CreateApplicationDto =
  | CreateApplicationV1Dto
  | CreateApplicationV2Dto
  | CreateApplicationV3Dto;

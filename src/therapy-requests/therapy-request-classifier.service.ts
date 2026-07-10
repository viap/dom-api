import { Injectable } from '@nestjs/common';
import { Contact } from '@/common/schemas/contact.schema';
import { UserDocument } from '@/users/schemas/user.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from './enums/therapy-request-analytics.enum';
import {
  classifyTherapyRequestAnalytics,
  TherapyRequestClassification,
  TherapyRequestClassifierInput,
} from './therapy-request-classifier.core';
import { TherapyRequestAnalyticsInference } from './types/therapy-request-analytics.types';

export interface TherapyRequestClassifierServiceInput
  extends TherapyRequestClassifierInput {
  name?: string;
  descr?: string;
  user?: UserDocument | { name?: string; contacts?: Contact[] };
  contacts?: Contact[];
  current?: {
    clientGender?: TherapyRequestClientGender;
    requestCategory?: TherapyRequestCategory;
    analyticsInference?: TherapyRequestAnalyticsInference;
  };
}

@Injectable()
export class TherapyRequestClassifierService {
  classify(
    input: TherapyRequestClassifierServiceInput,
  ): TherapyRequestClassification {
    return classifyTherapyRequestAnalytics(input);
  }
}

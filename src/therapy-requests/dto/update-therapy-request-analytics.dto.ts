import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';

export class UpdateTherapyRequestAnalyticsDto {
  readonly clientGender?: TherapyRequestClientGender;
  readonly requestCategory?: TherapyRequestCategory;
  readonly topic?: string;
  readonly analyticsReviewRequired?: boolean;
}

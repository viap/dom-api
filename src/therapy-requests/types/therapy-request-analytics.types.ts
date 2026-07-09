import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';

export interface TherapyRequestAnalyticsQuery {
  month?: string;
  startDate?: string;
  endDate?: string;
  clientGender?: TherapyRequestClientGender | string;
  requestCategory?: TherapyRequestCategory | string;
  topic?: string;
  psychologist?: string;
  accepted?: string | boolean;
  analyticsReviewRequired?: string | boolean;
  limit?: string | number;
  offset?: string | number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TherapyRequestAnalyticsRequest {
  _id: { toString: () => string };
  createdAt: Date;
  updatedAt?: Date;
  name: string;
  descr?: string;
  accepted?: boolean;
  clientGender?: TherapyRequestClientGender;
  requestCategory?: TherapyRequestCategory;
  topic?: string;
  analyticsReviewRequired?: boolean;
  analyticsInference?: unknown;
  psychologist?: unknown;
}

export type TherapyRequestAnalyticsRequestsResponse =
  PaginatedResponse<TherapyRequestAnalyticsRequest>;

export interface TherapyRequestAnalyticsFiltersResponse {
  clientGenders: TherapyRequestClientGender[];
  requestCategories: TherapyRequestCategory[];
  topics: string[];
  psychologists: Array<{
    id: string;
    name: string;
  }>;
}

export interface TherapyRequestAnalyticsSummaryResponse {
  totalRequests: number;
  reviewRequiredCount: number;
  monthly: Array<{
    month: string;
    total: number;
    byCategory: Record<string, number>;
    byGender: Record<string, number>;
  }>;
  categoryBreakdown: Array<{
    category: TherapyRequestCategory;
    total: number;
  }>;
  genderBreakdown: Array<{
    gender: TherapyRequestClientGender;
    total: number;
  }>;
}

export interface TherapyRequestAnalyticsLifecycleRow {
  requestId: string;
  psychologistId?: string;
  psychologistName: string;
  clientName: string;
  requestCreatedAt: Date;
  firstSessionAt?: Date;
  latestSessionAt?: Date;
  firstSessionDelayDays: number | null;
  lifecycleDays: number | null;
  linkedSessionCount: number;
  linkStatus: 'linked' | 'no_sessions';
}

export interface TherapyRequestAnalyticsPsychologistLifecycle {
  psychologistId: string;
  psychologistName: string;
  averageLifecycleDays: number;
  medianLifecycleDays: number;
  requestCount: number;
  linkedSessionCount: number;
  averageFirstSessionDelayDays: number;
  noSessionCount: number;
  insufficientData: boolean;
}

export interface TherapyRequestAnalyticsLifecycleResponse {
  shortestPsychologists: TherapyRequestAnalyticsPsychologistLifecycle[];
  longestPsychologists: TherapyRequestAnalyticsPsychologistLifecycle[];
  requestRows: TherapyRequestAnalyticsLifecycleRow[];
  requestRowsTotal: number;
  unlinkedSessionCount: number;
  noSessionRequestCount: number;
}

export interface AnalyticsFieldInferenceValue {
  value: string;
  confidence: number;
  sources: string[];
  reasons: string[];
  detectedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  manual: boolean;
  selfReported?: boolean;
}

export interface TherapyRequestAnalyticsInference {
  clientGender?: AnalyticsFieldInferenceValue;
  requestCategory?: AnalyticsFieldInferenceValue;
  topic?: AnalyticsFieldInferenceValue;
}

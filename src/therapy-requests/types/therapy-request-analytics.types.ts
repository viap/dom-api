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
  analyticsReviewRequired?: boolean;
  analyticsInference?: unknown;
  psychologist?: unknown;
}

export type TherapyRequestAnalyticsRequestsResponse =
  PaginatedResponse<TherapyRequestAnalyticsRequest>;

export interface TherapyRequestAnalyticsRequestDetails {
  _id: string;
  descr: string;
  contacts: TherapyRequestAnalyticsContact[];
}

export interface TherapyRequestAnalyticsContact {
  id?: string;
  network: string;
  username: string;
  hidden: boolean;
}

export interface TherapyRequestAnalyticsFiltersResponse {
  clientGenders: TherapyRequestClientGender[];
  requestCategories: TherapyRequestCategory[];
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
  firstTenSessionCount: number;
  firstTenMedianIntervalDays: number | null;
  linkedSessionCount: number;
  linkStatus: 'linked' | 'no_sessions';
  warnings: TherapyRequestAnalyticsWarningKey[];
}

export type TherapyRequestAnalyticsWarningKey =
  | 'invalid_session_date_ignored'
  | 'first_session_before_request_creation';

export type TherapyRequestAnalyticsMetricKey =
  | 'retention'
  | 'startRate'
  | 'timeToFirstSession'
  | 'regularity';

export type TherapyRequestAnalyticsMetricDescriptorKey =
  | TherapyRequestAnalyticsMetricKey
  | 'documentation';

export interface TherapyRequestAnalyticsMetricDescriptor {
  rawValueLabel: string;
  formula: string;
  explanation: string;
  unavailableReason?: string;
}

export interface TherapyRequestAnalyticsMetricBreakdown {
  status: 'available' | 'unavailable' | 'excluded';
  rawValue: number | null;
  score: number | null;
  weight: number;
  contribution: number | null;
  sampleSize: number;
  supportingValues?: Record<string, number>;
}

export interface TherapyRequestAnalyticsPsychologistLifecycle {
  psychologistId: string;
  psychologistName: string;
  baseScore: number | null;
  scoreStatus: 'scored' | 'insufficient_data';
  confidenceCoefficient: number;
  confidenceLevel: 'high' | 'low';
  clientsWithAtLeastOneSession: number;
  acceptedRequestCount: number;
  acceptedRequestsWithAtLeastOneSession: number;
  acceptedRequestsWithAtLeastTwoSessions: number;
  linkedSessionCount: number;
  noSessionCount: number;
  missingMetrics: TherapyRequestAnalyticsMetricKey[];
  warnings: TherapyRequestAnalyticsWarningKey[];
  metrics: {
    retention: TherapyRequestAnalyticsMetricBreakdown;
    startRate: TherapyRequestAnalyticsMetricBreakdown;
    timeToFirstSession: TherapyRequestAnalyticsMetricBreakdown;
    regularity: TherapyRequestAnalyticsMetricBreakdown;
    documentation: TherapyRequestAnalyticsMetricBreakdown;
  };
}

export interface TherapyRequestAnalyticsLifecycleResponse {
  topPsychologists: TherapyRequestAnalyticsPsychologistLifecycle[];
  bottomPsychologists: TherapyRequestAnalyticsPsychologistLifecycle[];
  insufficientDataPsychologists: TherapyRequestAnalyticsPsychologistLifecycle[];
  requestRows: TherapyRequestAnalyticsLifecycleRow[];
  requestRowsTotal: number;
  unlinkedSessionCount: number;
  noSessionRequestCount: number;
  scoringModel: {
    supportedWeights: Record<TherapyRequestAnalyticsMetricKey, number>;
    excludedMetrics: Array<{
      metric: 'documentation';
      reason: string;
    }>;
    metricDescriptors: Record<
      TherapyRequestAnalyticsMetricDescriptorKey,
      TherapyRequestAnalyticsMetricDescriptor
    >;
    confidenceThresholdClients: number;
    period: {
      startDate?: string;
      endDate?: string;
      month?: string;
      timezone: 'UTC';
    };
  };
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
}

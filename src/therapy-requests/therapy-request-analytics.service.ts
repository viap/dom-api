import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import ExcelJS from 'exceljs';
import { validateObjectId } from '@/common/utils/mongo-sanitizer';
import {
  Psychologist,
  PsychologistDocument,
} from '@/psychologists/schemas/psychologist.schema';
import {
  TherapySession,
  TherapySessionDocument,
} from '@/therapy-sessions/schemas/therapy-session.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from './enums/therapy-request-analytics.enum';
import {
  TherapyRequest,
  TherapyRequestDocument,
} from './schemas/therapy-request.schema';
import {
  PaginatedResponse,
  TherapyRequestAnalyticsMetricBreakdown,
  TherapyRequestAnalyticsMetricKey,
  TherapyRequestAnalyticsFiltersResponse,
  TherapyRequestAnalyticsLifecycleResponse,
  TherapyRequestAnalyticsPsychologistLifecycle,
  TherapyRequestAnalyticsQuery,
  TherapyRequestAnalyticsRequestDetails,
  TherapyRequestAnalyticsRequest,
  TherapyRequestAnalyticsRequestsResponse,
  TherapyRequestAnalyticsSummaryResponse,
  TherapyRequestAnalyticsWarningKey,
} from './types/therapy-request-analytics.types';

const dayMs = 1000 * 60 * 60 * 24;
const DEFAULT_REQUEST_LIMIT = 20;
const MAX_REQUEST_LIMIT = 1000;
const CONFIDENCE_THRESHOLD_CLIENTS = 5;
const DOCUMENTATION_UNAVAILABLE_REASON =
  'No independent source for completed sessions exists; recorded session rows are the only evidence a session happened.';
const SUPPORTED_KPI_WEIGHTS: Record<TherapyRequestAnalyticsMetricKey, number> =
  {
    retention: 0.3684,
    startRate: 0.2632,
    timeToFirstSession: 0.2105,
    regularity: 0.1579,
  };
const METRIC_DESCRIPTORS = {
  retention: {
    rawValueLabel: 'median capped sessions in first 10',
    formula: 'median(min(recordedSessionCount, 10)) / 10 * 100',
    explanation:
      'Uses the median capped recorded session count across accepted requests.',
  },
  startRate: {
    rawValueLabel: 'accepted requests with first session / accepted requests',
    formula:
      'acceptedRequestsWithAtLeastOneSession / allAcceptedRequests * 100',
    explanation:
      'Measures how many accepted requests have at least one linked session.',
  },
  timeToFirstSession: {
    rawValueLabel: 'median days from request creation to first session',
    formula: 'max(50, 100 - max(0, medianDaysToFirstSession - 1) * 5)',
    explanation:
      'Uses request creation time and the first linked session. Invalid negative delays are excluded.',
    unavailableReason:
      'No accepted request has a reliable first linked session.',
  },
  regularity: {
    rawValueLabel: 'median interval days between first 10 sessions',
    formula: 'max(0, 100 - abs(specialistMedianInterval - 7) * 10)',
    explanation:
      'Uses median calendar-day intervals between consecutive sessions in each request/client first 10 sessions.',
    unavailableReason: 'No accepted request has at least two linked sessions.',
  },
  documentation: {
    rawValueLabel: 'unavailable',
    formula:
      'Future metric: recordedRequiredSessions / min(actualCompletedSessions, 10)',
    explanation:
      'Documentation score is excluded from the current weighted score.',
    unavailableReason: DOCUMENTATION_UNAVAILABLE_REASON,
  },
} as const;

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function parseRequestLimit(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value)
      : DEFAULT_REQUEST_LIMIT;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_LIMIT;
  }

  return Math.min(parsed, MAX_REQUEST_LIMIT);
}

function parseRequestOffset(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value)
      : 0;

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function toPaginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page: Math.floor(offset / limit) + 1,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function normalizeOffsetToTotal(
  offset: number,
  limit: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  const lastPageOffset = (Math.ceil(total / limit) - 1) * limit;
  return Math.min(offset, lastPageOffset);
}

function toId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  const record = value as {
    _id?: { toString: () => string };
    toString?: () => string;
  };
  return record._id?.toString?.() || record.toString?.();
}

function toName(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  const record = value as { name?: string; user?: { name?: string } };
  return record.name || record.user?.name || '';
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

function normalizeGender(value?: string): TherapyRequestClientGender {
  return Object.values(TherapyRequestClientGender).includes(
    value as TherapyRequestClientGender,
  )
    ? (value as TherapyRequestClientGender)
    : TherapyRequestClientGender.Unknown;
}

function normalizeCategory(value?: string): TherapyRequestCategory {
  return Object.values(TherapyRequestCategory).includes(
    value as TherapyRequestCategory,
  )
    ? (value as TherapyRequestCategory)
    : TherapyRequestCategory.Unknown;
}

function normalizeReviewRequired(value?: boolean): boolean {
  return value !== false;
}

function daysBetween(from?: Date | number, to?: Date | number): number | null {
  if (!from || !to) {
    return null;
  }

  const fromDate = typeof from === 'number' ? new Date(from) : from;
  const toDate = typeof to === 'number' ? new Date(to) : to;
  const fromUtcDay = Date.UTC(
    fromDate.getUTCFullYear(),
    fromDate.getUTCMonth(),
    fromDate.getUTCDate(),
  );
  const toUtcDay = Date.UTC(
    toDate.getUTCFullYear(),
    toDate.getUTCMonth(),
    toDate.getUTCDate(),
  );
  return (toUtcDay - fromUtcDay) / dayMs;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round1((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

type DateRangeFilter = {
  $gte?: Date;
  $lte?: Date;
  $lt?: Date;
};

type ProjectedTherapyRequest = TherapyRequestAnalyticsRequest;

type SummaryInputRequest = Pick<
  ProjectedTherapyRequest,
  'createdAt' | 'clientGender' | 'requestCategory' | 'analyticsReviewRequired'
>;

type RequestSessionSummary = {
  firstSessionAt?: number;
  latestSessionAt?: number;
  linkedSessionCount: number;
  firstTenSessionDates: number[];
  invalidSessionDateCount: number;
};

export function buildFiniteSessionDateExpression(field = '$dateTime') {
  return {
    $and: [
      {
        $in: [{ $type: field }, ['int', 'long', 'double', 'decimal']],
      },
      { $gt: [field, -Infinity] },
      { $lt: [field, Infinity] },
    ],
  };
}

export function buildSessionCountPipeline(requestIds: unknown[]) {
  const validDateExpression = buildFiniteSessionDateExpression();
  return [
    { $match: { therapyRequest: { $in: requestIds } } },
    {
      $group: {
        _id: '$therapyRequest',
        linkedSessionCount: { $sum: 1 },
        invalidSessionDateCount: {
          $sum: {
            $cond: [validDateExpression, 0, 1],
          },
        },
      },
    },
  ];
}

export function buildSessionDatePipeline(requestIds: unknown[]) {
  return [
    { $match: { therapyRequest: { $in: requestIds } } },
    { $sort: { therapyRequest: 1, dateTime: 1, _id: 1 } },
    { $match: { $expr: buildFiniteSessionDateExpression() } },
    {
      $group: {
        _id: '$therapyRequest',
        firstSessionAt: { $first: '$dateTime' },
        latestSessionAt: { $last: '$dateTime' },
        firstTenSessionDates: {
          $firstN: { input: '$dateTime', n: 10 },
        },
      },
    },
  ];
}

type KpiRequestRow = TherapyRequestAnalyticsLifecycleResponse['requestRows'][0];

@Injectable()
export class TherapyRequestAnalyticsService {
  constructor(
    @InjectModel(TherapyRequest.name)
    private therapyRequestModel: Model<TherapyRequestDocument>,
    @InjectModel(TherapySession.name)
    private therapySessionModel: Model<TherapySessionDocument>,
    @InjectModel(Psychologist.name)
    private psychologistModel: Model<PsychologistDocument>,
  ) {}

  async getFilters(): Promise<TherapyRequestAnalyticsFiltersResponse> {
    const psychologists = await this.psychologistModel
      .find()
      .populate('user')
      .select('_id user')
      .exec();

    return {
      clientGenders: Object.values(TherapyRequestClientGender),
      requestCategories: Object.values(TherapyRequestCategory),
      psychologists: psychologists.map((psychologist) => ({
        id: psychologist._id.toString(),
        name: toName(psychologist),
      })),
    };
  }

  async getRequests(
    query: TherapyRequestAnalyticsQuery,
  ): Promise<TherapyRequestAnalyticsRequestsResponse> {
    const limit = parseRequestLimit(query.limit);
    const offset = parseRequestOffset(query.offset);
    const filter = this.buildRequestFilter(query);
    const total = await this.therapyRequestModel.countDocuments(filter).exec();
    const normalizedOffset = normalizeOffsetToTotal(offset, limit, total);
    const requests = await this.findRequests(query, {
      filter,
      limit,
      offset: normalizedOffset,
    });

    return toPaginatedResponse(requests, total, limit, normalizedOffset);
  }

  async getRequestDetails(
    therapyRequestId: string,
  ): Promise<TherapyRequestAnalyticsRequestDetails> {
    const validId = validateObjectId(therapyRequestId);
    if (!validId) {
      throw new NotFoundException('Invalid therapy request ID format');
    }

    const request = await this.therapyRequestModel
      .findById(validId)
      .select('_id descr contacts')
      .exec();

    if (!request) {
      throw new NotFoundException('Therapy request not found');
    }

    return {
      _id: request._id.toString(),
      descr: request.descr || '',
      contacts: (request.contacts || [])
        .filter((contact) => contact.hidden !== true)
        .map((contact) => ({
          ...(contact.id ? { id: contact.id } : {}),
          network: String(contact.network),
          username: contact.username,
          hidden: contact.hidden === true,
        })),
    };
  }

  async getSummary(
    query: TherapyRequestAnalyticsQuery,
  ): Promise<TherapyRequestAnalyticsSummaryResponse> {
    const [result] = await this.therapyRequestModel
      .aggregate([
        { $match: this.buildRequestFilter(query) },
        {
          $addFields: {
            _clientGender: {
              $ifNull: ['$clientGender', TherapyRequestClientGender.Unknown],
            },
            _requestCategory: {
              $ifNull: ['$requestCategory', TherapyRequestCategory.Unknown],
            },
            _analyticsReviewRequired: {
              $cond: [
                { $eq: ['$analyticsReviewRequired', false] },
                false,
                true,
              ],
            },
            _month: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' },
            },
          },
        },
        {
          $facet: {
            total: [{ $count: 'total' }],
            reviewRequired: [
              { $match: { _analyticsReviewRequired: true } },
              { $count: 'total' },
            ],
            monthlyTotals: [
              { $group: { _id: '$_month', total: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],
            monthlyCategories: [
              {
                $group: {
                  _id: { month: '$_month', category: '$_requestCategory' },
                  total: { $sum: 1 },
                },
              },
            ],
            monthlyGenders: [
              {
                $group: {
                  _id: { month: '$_month', gender: '$_clientGender' },
                  total: { $sum: 1 },
                },
              },
            ],
            categoryBreakdown: [
              { $group: { _id: '$_requestCategory', total: { $sum: 1 } } },
            ],
            genderBreakdown: [
              { $group: { _id: '$_clientGender', total: { $sum: 1 } } },
            ],
          },
        },
      ])
      .exec();

    return this.buildSummaryFromAggregation(result);
  }

  async getLifecycle(
    query: TherapyRequestAnalyticsQuery,
  ): Promise<TherapyRequestAnalyticsLifecycleResponse> {
    const requests = await this.findLifecycleRequests(query);
    return this.buildKpiLifecycle(query, requests);
  }

  private async buildKpiLifecycle(
    query: TherapyRequestAnalyticsQuery,
    requests: ProjectedTherapyRequest[],
    options: { paginateRows?: boolean } = { paginateRows: true },
  ): Promise<TherapyRequestAnalyticsLifecycleResponse> {
    const requestIds = requests.map((request) => request._id);
    const [sessionCountRows, sessionDateRows] = requestIds.length
      ? await Promise.all([
          this.therapySessionModel
            .aggregate(buildSessionCountPipeline(requestIds) as any[])
            .exec(),
          this.therapySessionModel
            .aggregate(buildSessionDatePipeline(requestIds) as any[])
            .exec(),
        ])
      : [[], []];

    const sessionsByRequest = new Map<string, RequestSessionSummary>();
    for (const row of sessionCountRows) {
      const requestId = toId(row._id);
      if (requestId) {
        sessionsByRequest.set(requestId, {
          linkedSessionCount: row.linkedSessionCount || 0,
          firstTenSessionDates: [],
          invalidSessionDateCount: row.invalidSessionDateCount || 0,
        });
      }
    }
    for (const row of sessionDateRows) {
      const requestId = toId(row._id);
      if (!requestId) {
        continue;
      }

      const summary = sessionsByRequest.get(requestId) || {
        linkedSessionCount: 0,
        firstTenSessionDates: [],
        invalidSessionDateCount: 0,
      };
      const firstTenSessionDates = (
        (row.firstTenSessionDates || []) as unknown[]
      ).filter(isValidTimestamp);
      sessionsByRequest.set(requestId, {
        ...summary,
        firstSessionAt: isValidTimestamp(row.firstSessionAt)
          ? row.firstSessionAt
          : undefined,
        latestSessionAt: isValidTimestamp(row.latestSessionAt)
          ? row.latestSessionAt
          : undefined,
        firstTenSessionDates,
      });
    }

    const requestRows = requests.map((request) => {
      const requestSessions = sessionsByRequest.get(request._id.toString());
      const firstSessionAt = requestSessions?.firstSessionAt
        ? new Date(requestSessions.firstSessionAt)
        : undefined;
      const latestSessionAt = requestSessions?.latestSessionAt
        ? new Date(requestSessions.latestSessionAt)
        : undefined;
      const psychologistId = toId(request.psychologist);
      const linkedSessionCount = requestSessions?.linkedSessionCount || 0;
      const firstTenSessionDates = requestSessions?.firstTenSessionDates || [];
      const firstSessionDelayDays = daysBetween(
        request.createdAt,
        firstSessionAt,
      );
      const warnings: TherapyRequestAnalyticsWarningKey[] = [];
      if (requestSessions?.invalidSessionDateCount) {
        warnings.push('invalid_session_date_ignored');
      }
      if (
        firstSessionAt &&
        firstSessionDelayDays !== null &&
        firstSessionDelayDays < 0
      ) {
        warnings.push('first_session_before_request_creation');
      }

      const firstTenIntervals = firstTenSessionDates
        .slice(1)
        .map((dateTime, index) =>
          daysBetween(firstTenSessionDates[index], dateTime),
        )
        .filter((value): value is number => typeof value === 'number');

      return {
        requestId: request._id.toString(),
        psychologistId,
        psychologistName: toName(request.psychologist),
        clientName: request.name,
        requestCreatedAt: request.createdAt,
        firstSessionAt,
        latestSessionAt,
        firstSessionDelayDays:
          firstSessionDelayDays !== null && firstSessionDelayDays >= 0
            ? firstSessionDelayDays
            : null,
        firstTenSessionCount: firstTenSessionDates.length,
        firstTenMedianIntervalDays: firstTenIntervals.length
          ? median(firstTenIntervals)
          : null,
        linkedSessionCount,
        linkStatus: linkedSessionCount
          ? ('linked' as const)
          : ('no_sessions' as const),
        warnings,
      };
    });

    const rowsByPsychologist = new Map<string, typeof requestRows>();
    for (const row of requestRows) {
      if (!row.psychologistId) {
        continue;
      }

      const list = rowsByPsychologist.get(row.psychologistId) || [];
      list.push(row);
      rowsByPsychologist.set(row.psychologistId, list);
    }

    const specialists = Array.from(rowsByPsychologist.entries()).map(
      ([psychologistId, rows]) => this.buildSpecialistKpi(psychologistId, rows),
    );
    const scoredSpecialists = specialists.filter(
      (row) => row.scoreStatus === 'scored' && row.baseScore !== null,
    );

    const unlinkedSessionCount = await this.countUnlinkedSessions(query);
    const requestRowsTotal = requestRows.length;
    const rowLimit = parseRequestLimit(query.limit);
    const rowOffset = normalizeOffsetToTotal(
      parseRequestOffset(query.offset),
      rowLimit,
      requestRowsTotal,
    );
    const paginatedRequestRows =
      options.paginateRows === false
        ? requestRows
        : requestRows.slice(rowOffset, rowOffset + rowLimit);
    const topPsychologists = [...scoredSpecialists]
      .sort((a, b) => this.sortScoredSpecialists(a, b, 'desc'))
      .slice(0, 10);
    const bottomPsychologists =
      scoredSpecialists.length > 10
        ? [...scoredSpecialists]
            .sort((a, b) => this.sortScoredSpecialists(a, b, 'asc'))
            .filter(
              (row) =>
                !topPsychologists.some(
                  (topRow) => topRow.psychologistId === row.psychologistId,
                ),
            )
            .slice(0, 10)
        : [];

    return {
      topPsychologists,
      bottomPsychologists,
      insufficientDataPsychologists: specialists
        .filter((row) => row.scoreStatus === 'insufficient_data')
        .sort((a, b) => this.sortSpecialistsByName(a, b)),
      requestRows: paginatedRequestRows,
      requestRowsTotal,
      unlinkedSessionCount,
      noSessionRequestCount: requestRows.filter(
        (row) => row.linkStatus === 'no_sessions',
      ).length,
      scoringModel: this.buildScoringModel(query),
    };
  }

  private buildSpecialistKpi(
    psychologistId: string,
    rows: KpiRequestRow[],
  ): TherapyRequestAnalyticsPsychologistLifecycle {
    const acceptedRequestCount = rows.length;
    const rowsWithLinkedSession = rows.filter(
      (row) => row.linkedSessionCount > 0,
    );
    const rowsWithReliableFirstSession = rows.filter(
      (row) => row.firstSessionAt && row.firstSessionDelayDays !== null,
    );
    const rowsWithTwoSessions = rows.filter(
      (row) => row.firstTenSessionCount >= 2,
    );
    const linkedSessionCount = rows.reduce(
      (sum, row) => sum + row.linkedSessionCount,
      0,
    );
    const noSessionCount = rows.filter(
      (row) => row.linkedSessionCount === 0,
    ).length;
    const clientsWithAtLeastOneSession = rowsWithLinkedSession.length;
    const confidenceCoefficient = round1(
      Math.min(clientsWithAtLeastOneSession / CONFIDENCE_THRESHOLD_CLIENTS, 1),
    );
    const confidenceLevel =
      clientsWithAtLeastOneSession >= CONFIDENCE_THRESHOLD_CLIENTS
        ? ('high' as const)
        : ('low' as const);

    const cappedSessionCounts = rows.map((row) =>
      Math.min(row.linkedSessionCount, 10),
    );
    const medianSessions = median(cappedSessionCounts);
    const retentionScore = round1((medianSessions / 10) * 100);
    const reachedSession2Count = rows.filter(
      (row) => row.linkedSessionCount >= 2,
    ).length;
    const reachedSession5Count = rows.filter(
      (row) => row.linkedSessionCount >= 5,
    ).length;
    const reachedSession10Count = rows.filter(
      (row) => row.linkedSessionCount >= 10,
    ).length;
    const retentionSupportingValues = {
      reachedSession2Count,
      reachedSession2Percent: round1(
        (reachedSession2Count / acceptedRequestCount) * 100,
      ),
      reachedSession5Count,
      reachedSession5Percent: round1(
        (reachedSession5Count / acceptedRequestCount) * 100,
      ),
      reachedSession10Count,
      reachedSession10Percent: round1(
        (reachedSession10Count / acceptedRequestCount) * 100,
      ),
    };

    const startRate = rowsWithLinkedSession.length / acceptedRequestCount;
    const startRateScore = round1(startRate * 100);

    const validFirstSessionDelays = rowsWithReliableFirstSession
      .map((row) => row.firstSessionDelayDays)
      .filter((value): value is number => typeof value === 'number');
    const medianDaysToFirstSession = validFirstSessionDelays.length
      ? median(validFirstSessionDelays)
      : null;
    const timeToFirstSessionScore =
      medianDaysToFirstSession === null
        ? null
        : round1(
            Math.max(50, 100 - Math.max(0, medianDaysToFirstSession - 1) * 5),
          );

    const clientMedianIntervals = rowsWithTwoSessions
      .map((row) => row.firstTenMedianIntervalDays)
      .filter((value): value is number => typeof value === 'number');
    const specialistMedianInterval = clientMedianIntervals.length
      ? median(clientMedianIntervals)
      : null;
    const regularityScore =
      specialistMedianInterval === null
        ? null
        : round1(
            Math.max(0, 100 - Math.abs(specialistMedianInterval - 7) * 10),
          );

    const metrics = {
      retention: this.buildMetric({
        status: acceptedRequestCount > 0 ? 'available' : 'unavailable',
        rawValue: acceptedRequestCount > 0 ? medianSessions : null,
        score: acceptedRequestCount > 0 ? retentionScore : null,
        metric: 'retention',
        sampleSize: acceptedRequestCount,
        supportingValues: retentionSupportingValues,
      }),
      startRate: this.buildMetric({
        status: acceptedRequestCount > 0 ? 'available' : 'unavailable',
        rawValue: acceptedRequestCount > 0 ? round1(startRate) : null,
        score: acceptedRequestCount > 0 ? startRateScore : null,
        metric: 'startRate',
        sampleSize: acceptedRequestCount,
      }),
      timeToFirstSession: this.buildMetric({
        status: medianDaysToFirstSession === null ? 'unavailable' : 'available',
        rawValue: medianDaysToFirstSession,
        score: timeToFirstSessionScore,
        metric: 'timeToFirstSession',
        sampleSize: rowsWithReliableFirstSession.length,
      }),
      regularity: this.buildMetric({
        status: specialistMedianInterval === null ? 'unavailable' : 'available',
        rawValue: specialistMedianInterval,
        score: regularityScore,
        metric: 'regularity',
        sampleSize: rowsWithTwoSessions.length,
      }),
      documentation: this.buildMetric({
        status: 'excluded',
        rawValue: null,
        score: null,
        metric: undefined,
        weight: 0,
        sampleSize: 0,
      }),
    };

    const missingMetrics = (
      Object.keys(
        SUPPORTED_KPI_WEIGHTS,
      ) as Array<TherapyRequestAnalyticsMetricKey>
    ).filter((metric) => metrics[metric].status !== 'available');
    const baseScore = missingMetrics.length
      ? null
      : round1(
          (
            Object.keys(
              SUPPORTED_KPI_WEIGHTS,
            ) as Array<TherapyRequestAnalyticsMetricKey>
          ).reduce(
            (sum, metric) => sum + (metrics[metric].contribution || 0),
            0,
          ),
        );

    return {
      psychologistId,
      psychologistName: rows[0]?.psychologistName || psychologistId,
      baseScore,
      scoreStatus: baseScore === null ? 'insufficient_data' : 'scored',
      confidenceCoefficient,
      confidenceLevel,
      clientsWithAtLeastOneSession,
      acceptedRequestCount,
      acceptedRequestsWithAtLeastOneSession: rowsWithLinkedSession.length,
      acceptedRequestsWithAtLeastTwoSessions: rowsWithTwoSessions.length,
      linkedSessionCount,
      noSessionCount,
      missingMetrics,
      warnings: Array.from(new Set(rows.flatMap((row) => row.warnings))),
      metrics,
    };
  }

  private buildMetric({
    status,
    rawValue,
    score,
    metric,
    weight,
    sampleSize,
    supportingValues,
  }: {
    status: TherapyRequestAnalyticsMetricBreakdown['status'];
    rawValue: number | null;
    score: number | null;
    metric?: TherapyRequestAnalyticsMetricKey;
    weight?: number;
    sampleSize: number;
    supportingValues?: Record<string, number>;
  }): TherapyRequestAnalyticsMetricBreakdown {
    const resolvedWeight =
      typeof weight === 'number'
        ? weight
        : metric
        ? SUPPORTED_KPI_WEIGHTS[metric]
        : 0;

    return {
      status,
      rawValue,
      score,
      weight: resolvedWeight,
      contribution:
        status === 'available' && score !== null
          ? round1(score * resolvedWeight)
          : null,
      sampleSize,
      ...(supportingValues ? { supportingValues } : {}),
    };
  }

  private sortScoredSpecialists(
    a: TherapyRequestAnalyticsPsychologistLifecycle,
    b: TherapyRequestAnalyticsPsychologistLifecycle,
    direction: 'asc' | 'desc',
  ): number {
    const scoreA = a.baseScore || 0;
    const scoreB = b.baseScore || 0;
    if (scoreA !== scoreB) {
      return direction === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    }

    return this.sortSpecialistsByName(a, b);
  }

  private sortSpecialistsByName(
    a: TherapyRequestAnalyticsPsychologistLifecycle,
    b: TherapyRequestAnalyticsPsychologistLifecycle,
  ): number {
    return (
      a.psychologistName.localeCompare(b.psychologistName) ||
      a.psychologistId.localeCompare(b.psychologistId)
    );
  }

  private buildScoringModel(query: TherapyRequestAnalyticsQuery) {
    return {
      supportedWeights: SUPPORTED_KPI_WEIGHTS,
      excludedMetrics: [
        {
          metric: 'documentation' as const,
          reason: DOCUMENTATION_UNAVAILABLE_REASON,
        },
      ],
      metricDescriptors: METRIC_DESCRIPTORS,
      confidenceThresholdClients: CONFIDENCE_THRESHOLD_CLIENTS,
      period: {
        ...(query.startDate ? { startDate: query.startDate } : {}),
        ...(query.endDate ? { endDate: query.endDate } : {}),
        ...(query.month ? { month: query.month } : {}),
        timezone: 'UTC' as const,
      },
    };
  }

  async exportXlsx(query: TherapyRequestAnalyticsQuery): Promise<Buffer> {
    const [requests, kpiRequests] = await Promise.all([
      this.findRequests(query, { capped: false }),
      this.findLifecycleRequests(query),
    ]);
    const [summary, lifecycle] = await Promise.all([
      this.buildSummaryFromRequests(requests),
      this.buildKpiLifecycle(query, kpiRequests, { paginateRows: false }),
    ]);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DOM Admin';
    workbook.created = new Date();

    const rawSheet = workbook.addWorksheet('Raw requests');
    rawSheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Created At', key: 'createdAt', width: 22 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Description', key: 'descr', width: 48 },
      { header: 'Gender', key: 'gender', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Psychologist', key: 'psychologist', width: 28 },
      { header: 'Accepted', key: 'accepted', width: 12 },
      { header: 'Review Required', key: 'reviewRequired', width: 18 },
    ];
    requests.forEach((request) =>
      rawSheet.addRow({
        id: request._id.toString(),
        createdAt: request.createdAt?.toISOString?.() || '',
        month: monthKey(request.createdAt),
        name: request.name,
        descr: request.descr,
        gender: request.clientGender,
        category: request.requestCategory,
        psychologist: toName(request.psychologist),
        accepted: request.accepted,
        reviewRequired: request.analyticsReviewRequired,
      }),
    );

    const monthlySheet = workbook.addWorksheet('Monthly summary');
    monthlySheet.columns = [
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'By Category', key: 'byCategory', width: 44 },
      { header: 'By Gender', key: 'byGender', width: 44 },
    ];
    summary.monthly.forEach((row) =>
      monthlySheet.addRow({
        ...row,
        byCategory: JSON.stringify(row.byCategory),
        byGender: JSON.stringify(row.byGender),
      }),
    );

    const categorySheet = workbook.addWorksheet('Category breakdown');
    categorySheet.columns = [
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Total', key: 'total', width: 10 },
    ];
    summary.categoryBreakdown.forEach((row) => categorySheet.addRow(row));

    const psychologistSheet = workbook.addWorksheet('Psychologist KPI scores');
    psychologistSheet.columns = [
      { header: 'Group', key: 'group', width: 18 },
      { header: 'Psychologist', key: 'psychologistName', width: 28 },
      { header: 'Base Score', key: 'baseScore', width: 14 },
      { header: 'Score Status', key: 'scoreStatus', width: 18 },
      {
        header: 'Confidence Coefficient',
        key: 'confidenceCoefficient',
        width: 24,
      },
      { header: 'Confidence Level', key: 'confidenceLevel', width: 20 },
      {
        header: 'Clients With First Session',
        key: 'clientsWithAtLeastOneSession',
        width: 28,
      },
      { header: 'Accepted Requests', key: 'acceptedRequestCount', width: 20 },
      {
        header: 'Requests With First Session',
        key: 'acceptedRequestsWithAtLeastOneSession',
        width: 28,
      },
      {
        header: 'Requests With 2+ Sessions',
        key: 'acceptedRequestsWithAtLeastTwoSessions',
        width: 28,
      },
      { header: 'Linked Sessions', key: 'linkedSessionCount', width: 18 },
      { header: 'No Session Count', key: 'noSessionCount', width: 18 },
      { header: 'Retention Raw', key: 'retentionRaw', width: 18 },
      { header: 'Retention Score', key: 'retentionScore', width: 18 },
      { header: 'Retention Weight', key: 'retentionWeight', width: 18 },
      {
        header: 'Retention Contribution',
        key: 'retentionContribution',
        width: 24,
      },
      { header: 'Start Rate Raw', key: 'startRateRaw', width: 18 },
      { header: 'Start Rate Score', key: 'startRateScore', width: 18 },
      { header: 'Start Rate Weight', key: 'startRateWeight', width: 20 },
      {
        header: 'Start Rate Contribution',
        key: 'startRateContribution',
        width: 26,
      },
      {
        header: 'Time To First Session Raw',
        key: 'timeToFirstSessionRaw',
        width: 28,
      },
      {
        header: 'Time To First Session Score',
        key: 'timeToFirstSessionScore',
        width: 30,
      },
      {
        header: 'Time To First Session Weight',
        key: 'timeToFirstSessionWeight',
        width: 30,
      },
      {
        header: 'Time To First Session Contribution',
        key: 'timeToFirstSessionContribution',
        width: 36,
      },
      { header: 'Regularity Raw', key: 'regularityRaw', width: 18 },
      { header: 'Regularity Score', key: 'regularityScore', width: 20 },
      { header: 'Regularity Weight', key: 'regularityWeight', width: 22 },
      {
        header: 'Regularity Contribution',
        key: 'regularityContribution',
        width: 26,
      },
      {
        header: 'Documentation Status',
        key: 'documentationStatus',
        width: 24,
      },
      {
        header: 'Documentation Reason',
        key: 'documentationReason',
        width: 64,
      },
      { header: 'Missing Metrics', key: 'missingMetrics', width: 30 },
      { header: 'Warnings', key: 'warnings', width: 40 },
    ];
    const addPsychologistRow = (
      group: string,
      row: TherapyRequestAnalyticsPsychologistLifecycle,
    ) =>
      psychologistSheet.addRow({
        group,
        ...row,
        retentionRaw: row.metrics.retention.rawValue,
        retentionScore: row.metrics.retention.score,
        retentionWeight: row.metrics.retention.weight,
        retentionContribution: row.metrics.retention.contribution,
        startRateRaw: row.metrics.startRate.rawValue,
        startRateScore: row.metrics.startRate.score,
        startRateWeight: row.metrics.startRate.weight,
        startRateContribution: row.metrics.startRate.contribution,
        timeToFirstSessionRaw: row.metrics.timeToFirstSession.rawValue,
        timeToFirstSessionScore: row.metrics.timeToFirstSession.score,
        timeToFirstSessionWeight: row.metrics.timeToFirstSession.weight,
        timeToFirstSessionContribution:
          row.metrics.timeToFirstSession.contribution,
        regularityRaw: row.metrics.regularity.rawValue,
        regularityScore: row.metrics.regularity.score,
        regularityWeight: row.metrics.regularity.weight,
        regularityContribution: row.metrics.regularity.contribution,
        documentationStatus: row.metrics.documentation.status,
        documentationReason:
          lifecycle.scoringModel.metricDescriptors.documentation
            .unavailableReason,
        missingMetrics: row.missingMetrics.join(', '),
        warnings: row.warnings.join(', '),
      });
    lifecycle.topPsychologists.forEach((row) => addPsychologistRow('top', row));
    lifecycle.bottomPsychologists.forEach((row) =>
      addPsychologistRow('bottom', row),
    );
    lifecycle.insufficientDataPsychologists.forEach((row) =>
      addPsychologistRow('insufficient_data', row),
    );

    const requestLifecycleSheet = workbook.addWorksheet('KPI request audit');
    requestLifecycleSheet.columns = [
      { header: 'Request ID', key: 'requestId', width: 28 },
      { header: 'Psychologist', key: 'psychologistName', width: 28 },
      { header: 'Client', key: 'clientName', width: 24 },
      { header: 'Created At', key: 'requestCreatedAt', width: 22 },
      { header: 'First Session At', key: 'firstSessionAt', width: 22 },
      { header: 'Latest Session At', key: 'latestSessionAt', width: 22 },
      { header: 'First Delay Days', key: 'firstSessionDelayDays', width: 18 },
      {
        header: 'All Sessions',
        key: 'linkedSessionCount',
        width: 18,
      },
      {
        header: 'First 10 Median Interval Days',
        key: 'firstTenMedianIntervalDays',
        width: 32,
      },
      { header: 'Link Status', key: 'linkStatus', width: 16 },
      { header: 'Warnings', key: 'warnings', width: 40 },
    ];
    lifecycle.requestRows.forEach((row) =>
      requestLifecycleSheet.addRow({
        ...row,
        warnings: row.warnings.join(', '),
      }),
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async findRequests(
    query: TherapyRequestAnalyticsQuery,
    options: {
      capped?: boolean;
      filter?: FilterQuery<TherapyRequestDocument>;
      limit?: number;
      offset?: number;
    } = { capped: true },
  ): Promise<ProjectedTherapyRequest[]> {
    const requestQuery = this.therapyRequestModel
      .find(options.filter || this.buildRequestFilter(query))
      .select(
        '_id createdAt updatedAt name descr accepted clientGender requestCategory analyticsReviewRequired analyticsInference psychologist',
      )
      .populate({
        path: 'psychologist',
        select: '_id user',
        populate: {
          path: 'user',
          select: 'name',
          model: 'User',
        },
      })
      .sort({ createdAt: -1 });

    if (options.capped !== false) {
      requestQuery
        .skip(options.offset ?? parseRequestOffset(query.offset))
        .limit(options.limit ?? parseRequestLimit(query.limit));
    }

    return requestQuery.exec() as Promise<ProjectedTherapyRequest[]>;
  }

  private async findLifecycleRequests(
    query: TherapyRequestAnalyticsQuery,
  ): Promise<ProjectedTherapyRequest[]> {
    const lifecycleQuery = { ...query };
    delete lifecycleQuery.accepted;
    const filter = {
      ...this.buildRequestFilter(lifecycleQuery),
      accepted: true,
    };

    return this.therapyRequestModel
      .find(filter)
      .select('_id createdAt name accepted psychologist')
      .populate({
        path: 'psychologist',
        select: '_id user',
        populate: {
          path: 'user',
          select: 'name',
          model: 'User',
        },
      })
      .sort({ createdAt: -1 })
      .exec() as Promise<ProjectedTherapyRequest[]>;
  }

  private buildSummaryFromAggregation(result?: {
    total?: Array<{ total: number }>;
    reviewRequired?: Array<{ total: number }>;
    monthlyTotals?: Array<{ _id: string; total: number }>;
    monthlyCategories?: Array<{
      _id: { month: string; category: string };
      total: number;
    }>;
    monthlyGenders?: Array<{
      _id: { month: string; gender: string };
      total: number;
    }>;
    categoryBreakdown?: Array<{ _id: string; total: number }>;
    genderBreakdown?: Array<{ _id: string; total: number }>;
  }): TherapyRequestAnalyticsSummaryResponse {
    const monthlyMap = new Map<
      string,
      {
        month: string;
        total: number;
        byCategory: Record<string, number>;
        byGender: Record<string, number>;
      }
    >();

    for (const row of result?.monthlyTotals || []) {
      monthlyMap.set(row._id, {
        month: row._id,
        total: row.total,
        byCategory: {},
        byGender: {},
      });
    }

    for (const row of result?.monthlyCategories || []) {
      const month = row._id.month;
      const entry = monthlyMap.get(month) || {
        month,
        total: 0,
        byCategory: {},
        byGender: {},
      };
      entry.byCategory[normalizeCategory(row._id.category)] = row.total;
      monthlyMap.set(month, entry);
    }

    for (const row of result?.monthlyGenders || []) {
      const month = row._id.month;
      const entry = monthlyMap.get(month) || {
        month,
        total: 0,
        byCategory: {},
        byGender: {},
      };
      entry.byGender[normalizeGender(row._id.gender)] = row.total;
      monthlyMap.set(month, entry);
    }

    return {
      totalRequests: result?.total?.[0]?.total || 0,
      reviewRequiredCount: result?.reviewRequired?.[0]?.total || 0,
      monthly: Array.from(monthlyMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      categoryBreakdown: Object.values(TherapyRequestCategory).map(
        (category) => ({
          category,
          total:
            result?.categoryBreakdown?.find(
              (row) => normalizeCategory(row._id) === category,
            )?.total || 0,
        }),
      ),
      genderBreakdown: Object.values(TherapyRequestClientGender).map(
        (gender) => ({
          gender,
          total:
            result?.genderBreakdown?.find(
              (row) => normalizeGender(row._id) === gender,
            )?.total || 0,
        }),
      ),
    };
  }

  private buildSummaryFromRequests(
    requests: SummaryInputRequest[],
  ): TherapyRequestAnalyticsSummaryResponse {
    const monthlyMap = new Map<
      string,
      {
        month: string;
        total: number;
        byCategory: Record<string, number>;
        byGender: Record<string, number>;
      }
    >();

    for (const request of requests) {
      const month = monthKey(request.createdAt);
      const category = normalizeCategory(request.requestCategory);
      const gender = normalizeGender(request.clientGender);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          total: 0,
          byCategory: {},
          byGender: {},
        });
      }

      const entry = monthlyMap.get(month);
      entry.total += 1;
      entry.byCategory[category] = (entry.byCategory[category] || 0) + 1;
      entry.byGender[gender] = (entry.byGender[gender] || 0) + 1;
    }

    return {
      totalRequests: requests.length,
      reviewRequiredCount: requests.filter((request) =>
        normalizeReviewRequired(request.analyticsReviewRequired),
      ).length,
      monthly: Array.from(monthlyMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      categoryBreakdown: Object.values(TherapyRequestCategory).map(
        (category) => ({
          category,
          total: requests.filter(
            (request) =>
              normalizeCategory(request.requestCategory) === category,
          ).length,
        }),
      ),
      genderBreakdown: Object.values(TherapyRequestClientGender).map(
        (gender) => ({
          gender,
          total: requests.filter(
            (request) => normalizeGender(request.clientGender) === gender,
          ).length,
        }),
      ),
    };
  }

  private buildRequestFilter(
    query: TherapyRequestAnalyticsQuery,
  ): FilterQuery<TherapyRequestDocument> {
    const filter: FilterQuery<TherapyRequestDocument> = {};

    const dateRange = this.parseDateRange(query);
    if (dateRange) {
      filter.createdAt = dateRange;
    }

    if (
      query.clientGender &&
      Object.values(TherapyRequestClientGender).includes(
        query.clientGender as TherapyRequestClientGender,
      )
    ) {
      filter.clientGender =
        query.clientGender === TherapyRequestClientGender.Unknown
          ? { $in: [TherapyRequestClientGender.Unknown, null] }
          : query.clientGender;
    }

    if (
      query.requestCategory &&
      Object.values(TherapyRequestCategory).includes(
        query.requestCategory as TherapyRequestCategory,
      )
    ) {
      filter.requestCategory =
        query.requestCategory === TherapyRequestCategory.Unknown
          ? { $in: [TherapyRequestCategory.Unknown, null] }
          : query.requestCategory;
    }

    const psychologist = validateObjectId(query.psychologist);
    if (psychologist) {
      filter.psychologist = new Types.ObjectId(psychologist);
    }

    const accepted = parseBoolean(query.accepted);
    if (typeof accepted === 'boolean') {
      filter.accepted = accepted;
    }

    const analyticsReviewRequired = parseBoolean(query.analyticsReviewRequired);
    if (typeof analyticsReviewRequired === 'boolean') {
      filter.analyticsReviewRequired = analyticsReviewRequired
        ? { $ne: false }
        : false;
    }

    return filter;
  }

  private parseDateRange(
    query: TherapyRequestAnalyticsQuery,
  ): DateRangeFilter | undefined {
    if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
      const [year, month] = query.month.split('-').map(Number);
      const from = new Date(Date.UTC(year, month - 1, 1));
      const to = new Date(Date.UTC(year, month, 1));
      return { $gte: from, $lt: to };
    }

    const range: { $gte?: Date; $lte?: Date } = {};
    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!Number.isNaN(start.getTime())) {
        range.$gte = start;
      }
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!Number.isNaN(end.getTime())) {
        end.setUTCHours(23, 59, 59, 999);
        range.$lte = end;
      }
    }

    return Object.keys(range).length ? range : undefined;
  }

  private async countUnlinkedSessions(query: TherapyRequestAnalyticsQuery) {
    const sessionFilter: FilterQuery<TherapySessionDocument> = {
      therapyRequest: { $exists: false },
    };
    const dateRange = this.parseDateRange(query);
    if (dateRange) {
      sessionFilter.dateTime = {};
      if (dateRange.$gte) {
        sessionFilter.dateTime.$gte = dateRange.$gte.getTime();
      }
      if (dateRange.$lte) {
        sessionFilter.dateTime.$lte = dateRange.$lte.getTime();
      }
      if (dateRange.$lt) {
        sessionFilter.dateTime.$lt = dateRange.$lt.getTime();
      }
    }

    return this.therapySessionModel.countDocuments(sessionFilter).exec();
  }
}

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
  TherapyRequestAnalyticsFiltersResponse,
  TherapyRequestAnalyticsLifecycleResponse,
  TherapyRequestAnalyticsQuery,
  TherapyRequestAnalyticsRequestDetails,
  TherapyRequestAnalyticsRequest,
  TherapyRequestAnalyticsRequestsResponse,
  TherapyRequestAnalyticsSummaryResponse,
} from './types/therapy-request-analytics.types';

const dayMs = 1000 * 60 * 60 * 24;
const DEFAULT_REQUEST_LIMIT = 20;
const MAX_REQUEST_LIMIT = 1000;

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

  const fromMs = typeof from === 'number' ? from : from.getTime();
  const toMs = typeof to === 'number' ? to : to.getTime();
  return Math.round(((toMs - fromMs) / dayMs) * 10) / 10;
}

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
  }
  return sorted[middle];
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10
  );
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
    return this.buildLifecycle(query, requests);
  }

  private async buildLifecycle(
    query: TherapyRequestAnalyticsQuery,
    requests: ProjectedTherapyRequest[],
    options: { paginateRows?: boolean } = { paginateRows: true },
  ): Promise<TherapyRequestAnalyticsLifecycleResponse> {
    const requestIds = requests.map((request) => request._id);
    const sessionRows = requestIds.length
      ? await this.therapySessionModel
          .aggregate([
            { $match: { therapyRequest: { $in: requestIds } } },
            {
              $group: {
                _id: '$therapyRequest',
                firstSessionAt: { $min: '$dateTime' },
                latestSessionAt: { $max: '$dateTime' },
                linkedSessionCount: { $sum: 1 },
              },
            },
          ])
          .exec()
      : [];

    const sessionsByRequest = new Map<
      string,
      {
        firstSessionAt?: number;
        latestSessionAt?: number;
        linkedSessionCount: number;
      }
    >();
    for (const row of sessionRows) {
      const requestId = toId(row._id);
      if (requestId) {
        sessionsByRequest.set(requestId, row);
      }
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

      return {
        requestId: request._id.toString(),
        psychologistId,
        psychologistName: toName(request.psychologist),
        clientName: request.name,
        requestCreatedAt: request.createdAt,
        firstSessionAt,
        latestSessionAt,
        firstSessionDelayDays: daysBetween(request.createdAt, firstSessionAt),
        lifecycleDays: daysBetween(request.createdAt, latestSessionAt),
        linkedSessionCount,
        linkStatus: linkedSessionCount
          ? ('linked' as const)
          : ('no_sessions' as const),
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

    const rankings = Array.from(rowsByPsychologist.entries())
      .map(([psychologistId, rows]) => {
        const linkedRows = rows.filter(
          (row) => typeof row.lifecycleDays === 'number',
        );
        const lifecycleDays = linkedRows.map((row) => row.lifecycleDays);
        const firstSessionDelayDays = linkedRows
          .map((row) => row.firstSessionDelayDays)
          .filter((value): value is number => typeof value === 'number');

        return {
          psychologistId,
          psychologistName: rows[0]?.psychologistName || psychologistId,
          averageLifecycleDays: average(lifecycleDays),
          medianLifecycleDays: median(lifecycleDays),
          requestCount: linkedRows.length,
          linkedSessionCount: linkedRows.reduce(
            (sum, row) => sum + row.linkedSessionCount,
            0,
          ),
          averageFirstSessionDelayDays: average(firstSessionDelayDays),
          noSessionCount: rows.filter((row) => row.linkStatus === 'no_sessions')
            .length,
          insufficientData: linkedRows.length === 0,
        };
      })
      .filter((row) => !row.insufficientData);

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

    return {
      shortestPsychologists: [...rankings]
        .sort((a, b) => a.averageLifecycleDays - b.averageLifecycleDays)
        .slice(0, 10),
      longestPsychologists: [...rankings]
        .sort((a, b) => b.averageLifecycleDays - a.averageLifecycleDays)
        .slice(0, 10),
      requestRows: paginatedRequestRows,
      requestRowsTotal,
      unlinkedSessionCount,
      noSessionRequestCount: requestRows.filter(
        (row) => row.linkStatus === 'no_sessions',
      ).length,
    };
  }

  async exportXlsx(query: TherapyRequestAnalyticsQuery): Promise<Buffer> {
    const requests = await this.findRequests(query, { capped: false });
    const [summary, lifecycle] = await Promise.all([
      this.buildSummaryFromRequests(requests),
      this.buildLifecycle(query, requests, { paginateRows: false }),
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

    const psychologistSheet = workbook.addWorksheet('Psychologist lifecycle');
    psychologistSheet.columns = [
      { header: 'Group', key: 'group', width: 12 },
      { header: 'Psychologist', key: 'psychologistName', width: 28 },
      {
        header: 'Average Lifecycle Days',
        key: 'averageLifecycleDays',
        width: 24,
      },
      {
        header: 'Median Lifecycle Days',
        key: 'medianLifecycleDays',
        width: 24,
      },
      { header: 'Request Count', key: 'requestCount', width: 16 },
      { header: 'Linked Sessions', key: 'linkedSessionCount', width: 18 },
      {
        header: 'Average First Delay',
        key: 'averageFirstSessionDelayDays',
        width: 22,
      },
      { header: 'No Session Count', key: 'noSessionCount', width: 18 },
    ];
    lifecycle.shortestPsychologists.forEach((row) =>
      psychologistSheet.addRow({ group: 'shortest', ...row }),
    );
    lifecycle.longestPsychologists.forEach((row) =>
      psychologistSheet.addRow({ group: 'longest', ...row }),
    );

    const requestLifecycleSheet = workbook.addWorksheet('Request lifecycles');
    requestLifecycleSheet.columns = [
      { header: 'Request ID', key: 'requestId', width: 28 },
      { header: 'Psychologist', key: 'psychologistName', width: 28 },
      { header: 'Client', key: 'clientName', width: 24 },
      { header: 'Created At', key: 'requestCreatedAt', width: 22 },
      { header: 'First Session At', key: 'firstSessionAt', width: 22 },
      { header: 'Latest Session At', key: 'latestSessionAt', width: 22 },
      { header: 'First Delay Days', key: 'firstSessionDelayDays', width: 18 },
      { header: 'Lifecycle Days', key: 'lifecycleDays', width: 18 },
      { header: 'Linked Sessions', key: 'linkedSessionCount', width: 18 },
      { header: 'Link Status', key: 'linkStatus', width: 16 },
    ];
    lifecycle.requestRows.forEach((row) => requestLifecycleSheet.addRow(row));

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
    return this.therapyRequestModel
      .find(this.buildRequestFilter(query))
      .select('_id createdAt name psychologist')
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

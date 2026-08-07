import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';
import type { AnalyticsGranularity } from '../types/therapy-request-analytics.types';

const analyticsGranularities: AnalyticsGranularity[] = [
  'day',
  'week',
  'month',
  'year',
];

export const therapyRequestAnalyticsQuerySchema = Joi.object({
  month: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  granularity: Joi.string()
    .valid(...analyticsGranularities)
    .default('week'),
  clientGender: Joi.string()
    .valid(...Object.values(TherapyRequestClientGender))
    .optional(),
  requestCategory: Joi.string()
    .valid(...Object.values(TherapyRequestCategory))
    .optional(),
  psychologist: joiObjectId.optional(),
  accepted: Joi.boolean().truthy('true').falsy('false').optional(),
  analyticsReviewRequired: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .optional(),
  limit: Joi.number().integer().min(1).max(1000).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

import * as Joi from 'joi';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';
import { UpdateTherapyRequestAnalyticsDto } from '../dto/update-therapy-request-analytics.dto';

export const joiUpdateTherapyRequestAnalyticsSchema =
  Joi.object<UpdateTherapyRequestAnalyticsDto>({
    clientGender: Joi.string().valid(
      ...Object.values(TherapyRequestClientGender),
    ),
    requestCategory: Joi.string().valid(
      ...Object.values(TherapyRequestCategory),
    ),
    topic: Joi.string().allow('').max(160),
    analyticsReviewRequired: Joi.boolean(),
  }).min(1);

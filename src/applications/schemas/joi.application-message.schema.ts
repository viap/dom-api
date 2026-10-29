import * as Joi from 'joi';
import { joiApiClientSchema } from '@/api-clients/schemas/joi.api-client.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import {
  ClaimApplicationMessageDto,
  CreateApplicationMessageDto,
  ListApplicationMessageThreadsDto,
  ReceiveApplicationReplyDto,
  ReportApplicationMessageDto,
} from '../dto/application-message.dto';
import { ApplicationMessageStatus } from '../enums/application-message.enum';
import { APPLICATION_MESSAGE_MAX_LENGTH } from '@/common/application-messaging/application-messaging-policy.service';

const telegramIdSchema = Joi.string()
  .pattern(/^-?\d{1,20}$/)
  .required();
const telegramMessageIdSchema = Joi.number().integer().positive().required();

export const createApplicationMessageSchema =
  Joi.object<CreateApplicationMessageDto>({
    clientMessageId: Joi.string()
      .guid({ version: ['uuidv4'] })
      .required(),
    text: Joi.string()
      .trim()
      .min(1)
      .max(APPLICATION_MESSAGE_MAX_LENGTH)
      .required(),
  });

export const claimApplicationMessageSchema =
  Joi.object<ClaimApplicationMessageDto>({
    apiClient: joiApiClientSchema.required(),
  });

export const listApplicationMessageThreadsSchema =
  Joi.object<ListApplicationMessageThreadsDto>({
    apiClient: joiApiClientSchema.required(),
    privateChatId: telegramIdSchema,
    telegramUserId: telegramIdSchema,
    applicationId: joiObjectId.optional(),
    page: Joi.number().integer().min(0).max(1000).default(0),
  });

export const reportApplicationMessageSchema =
  Joi.object<ReportApplicationMessageDto>({
    apiClient: joiApiClientSchema.required(),
    messageId: joiObjectId.required(),
    status: Joi.string()
      .valid(
        ApplicationMessageStatus.Sent,
        ApplicationMessageStatus.Failed,
        ApplicationMessageStatus.Unknown,
      )
      .required(),
    telegramMessageId: Joi.when('status', {
      is: ApplicationMessageStatus.Sent,
      then: telegramMessageIdSchema,
      otherwise: Joi.forbidden(),
    }),
    errorCode: Joi.when('status', {
      is: ApplicationMessageStatus.Sent,
      then: Joi.forbidden(),
      otherwise: Joi.string()
        .trim()
        .pattern(/^[a-z0-9_.-]+$/)
        .max(100)
        .required(),
    }),
  });

export const receiveApplicationReplySchema =
  Joi.object<ReceiveApplicationReplyDto>({
    apiClient: joiApiClientSchema.required(),
    privateChatId: telegramIdSchema,
    telegramUserId: telegramIdSchema,
    telegramMessageId: telegramMessageIdSchema,
    replyToTelegramMessageId: telegramMessageIdSchema.optional(),
    applicationId: joiObjectId.optional(),
    text: Joi.string()
      .trim()
      .max(APPLICATION_MESSAGE_MAX_LENGTH)
      .allow('')
      .optional(),
  }).xor('replyToTelegramMessageId', 'applicationId');

import * as Joi from 'joi';
import { joiApiClientSchema } from '@/api-clients/schemas/joi.api-client.schema';
import { joiTelegramUserSchema } from '@/auth/schemas/joi.telegram-user.schema';
import {
  ConfirmTelegramLinkDto,
  CreateTelegramLinkDto,
  ExchangeTelegramLinkDto,
  TelegramContactSessionDto,
} from '@/telegram-contact/dto/telegram-contact.dto';

const secretSchema = Joi.string()
  .pattern(/^[A-Za-z0-9_-]{32,128}$/)
  .required();

export const createTelegramLinkSchema = Joi.object<CreateTelegramLinkDto>({
  apiClient: joiApiClientSchema.required(),
});

export const confirmTelegramLinkSchema = Joi.object<ConfirmTelegramLinkDto>({
  apiClient: joiApiClientSchema.required(),
  startToken: secretSchema,
  privateChatId: Joi.string()
    .pattern(/^-?\d{1,20}$/)
    .required(),
  telegram: joiTelegramUserSchema
    .keys({
      id: Joi.string()
        .pattern(/^\d{1,20}$/)
        .required(),
      username: Joi.string()
        .pattern(/^[A-Za-z0-9_]{5,32}$/)
        .allow('')
        .optional(),
    })
    .required(),
});

export const exchangeTelegramLinkSchema = Joi.object<ExchangeTelegramLinkDto>({
  apiClient: joiApiClientSchema.required(),
  browserProof: secretSchema,
  currentSessionToken: secretSchema.optional(),
});

export const telegramContactSessionSchema =
  Joi.object<TelegramContactSessionDto>({
    apiClient: joiApiClientSchema.required(),
    sessionToken: secretSchema,
  });

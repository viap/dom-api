import { ApiClientDto } from '@/api-clients/dto/api-client.dto';
import { ApplicationMessageStatus } from '../enums/application-message.enum';

export class CreateApplicationMessageDto {
  clientMessageId: string;
  text: string;
}

export class ClaimApplicationMessageDto {
  apiClient: ApiClientDto;
}

export class ListApplicationMessageThreadsDto {
  apiClient: ApiClientDto;
  privateChatId: string;
  telegramUserId: string;
  applicationId?: string;
  page?: number;
}

export class ReportApplicationMessageDto {
  apiClient: ApiClientDto;
  messageId: string;
  status:
    | ApplicationMessageStatus.Sent
    | ApplicationMessageStatus.Failed
    | ApplicationMessageStatus.Unknown;
  telegramMessageId?: number;
  errorCode?: string;
}

export class ReceiveApplicationReplyDto {
  apiClient: ApiClientDto;
  privateChatId: string;
  telegramUserId: string;
  telegramMessageId: number;
  replyToTelegramMessageId?: number;
  applicationId?: string;
  text?: string;
}

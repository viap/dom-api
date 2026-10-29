import { ApiClientDto } from '@/api-clients/dto/api-client.dto';
import { TelegramUserDto } from '@/auth/dto/telegram.dto';

export class CreateTelegramLinkDto {
  apiClient: ApiClientDto;
}

export class ConfirmTelegramLinkDto {
  apiClient: ApiClientDto;
  startToken: string;
  privateChatId: string;
  telegram: TelegramUserDto;
}

export class ExchangeTelegramLinkDto {
  apiClient: ApiClientDto;
  browserProof: string;
  currentSessionToken?: string;
}

export class TelegramContactSessionDto {
  apiClient: ApiClientDto;
  sessionToken: string;
}

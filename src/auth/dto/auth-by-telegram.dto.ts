import { ApiClientDto } from 'src/api-clients/dto/api-client.dto';
import { TelegramUserDto } from './telegram.dto';

export class AuthByTelegramDto {
  apiClient: ApiClientDto;
  telegram: TelegramUserDto;
}

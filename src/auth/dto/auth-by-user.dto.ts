import { ApiClientDto } from '../../api-clients/dto/api-client.dto';
import { AuthUserDto } from './auth-user.dto';

export class AuthByUserDto {
  apiClient: ApiClientDto;

  user: AuthUserDto;
}

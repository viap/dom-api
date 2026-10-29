import { ApiClientDto } from '@/api-clients/dto/api-client.dto';
import { CreateApplicationDto } from '@/applications/dto/create-application.dto';

export class CreatePublicApplicationDto {
  apiClient: ApiClientDto;
  application: CreateApplicationDto;
  contactSessionToken?: string;
}

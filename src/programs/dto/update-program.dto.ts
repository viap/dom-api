import { Price } from '@/common/schemas/price.schema';
import { ProgramFormat } from '../enums/program-format.enum';
import { ProgramKind } from '../enums/program-kind.enum';
import { ProgramStatus } from '../enums/program-status.enum';

export interface UpdateProgramDto {
  domainId?: string;
  kind?: ProgramKind;
  status?: ProgramStatus;
  title?: string;
  slug?: string;
  startDate?: number;
  endDate?: number;
  applicationDeadline?: number;
  format?: ProgramFormat;
  priceGroups?: Array<{
    title?: string;
    deadline?: string;
    price: Price;
  }>;
  modules?: Array<{
    title: string;
    description?: string;
    order: number;
    durationHours?: number;
  }>;
  speakerIds?: string[];
  organizerIds?: string[];
  partnerIds?: string[];
}

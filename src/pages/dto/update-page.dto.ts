import { PageStatus } from '../enums/page-status.enum';

export interface UpdatePageDto {
  domainId?: string | null;
  slug?: string;
  title?: string;
  status?: PageStatus;
  seo?: Record<string, string>;
}

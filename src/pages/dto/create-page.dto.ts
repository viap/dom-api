import { PageStatus } from '../enums/page-status.enum';

export interface CreatePageDto {
  domainId?: string;
  slug: string;
  title: string;
  status?: PageStatus;
  seo?: Record<string, string>;
}

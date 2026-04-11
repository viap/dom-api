import { PageStatus } from '../enums/page-status.enum';
import { PageBlock } from '../types/page-block.interface';

export interface CreatePageDto {
  domainId?: string;
  slug: string;
  title: string;
  status?: PageStatus;
  seo?: Record<string, string>;
  blocks?: PageBlock[];
}

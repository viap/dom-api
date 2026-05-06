import { PageStatus } from '../enums/page-status.enum';
import { PageBlock } from '../types/page-block.interface';

export interface UpdatePageDto {
  domainId?: string | null;
  slug?: string;
  title?: string;
  status?: PageStatus;
  isHomepage?: boolean;
  seo?: Record<string, string>;
  blocks?: PageBlock[];
}

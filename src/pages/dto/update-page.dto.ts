import { PageStatus } from '../enums/page-status.enum';
import { PageRootBlock } from '../types/page-block.interface';

export interface UpdatePageDto {
  domainId?: string | null;
  slug?: string;
  title?: string;
  status?: PageStatus;
  isHomepage?: boolean;
  isTitleVisible?: boolean;
  seo?: Record<string, string>;
  blocks?: PageRootBlock[];
}

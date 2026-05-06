import { DomainCode } from '../enums/domain-code.enum';

export interface UpdateDomainDto {
  code?: DomainCode;
  title?: string;
  slug?: string;
  isActive?: boolean;
  order?: number;
  seo?: Record<string, string>;
}

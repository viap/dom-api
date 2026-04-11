import { MenuItemDto } from './create-menu.dto';

export interface UpdateMenuDto {
  key?: string;
  title?: string;
  domainId?: string | null;
  isActive?: boolean;
  items?: MenuItemDto[];
}

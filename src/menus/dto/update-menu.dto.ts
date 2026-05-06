import { MenuItemDto } from './create-menu.dto';

export interface UpdateMenuDto {
  key?: string | null;
  title?: string;
  pageId?: string | null;
  isActive?: boolean;
  items?: MenuItemDto[];
}

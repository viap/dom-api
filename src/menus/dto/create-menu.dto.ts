import { MenuItemType } from '../enums/menu-item-type.enum';

export interface MenuItemDto {
  id?: string;
  title: string;
  type: MenuItemType;
  targetId?: string;
  url?: string;
  order: number;
  children?: MenuItemDto[];
  isVisible?: boolean;
  openInNewTab?: boolean;
}

export interface CreateMenuDto {
  key: string;
  title: string;
  domainId?: string;
  isActive?: boolean;
  items?: MenuItemDto[];
}

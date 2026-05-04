export interface MenuAdminQueryParams {
  limit?: string;
  offset?: string;
  key?: string;
  pageId?: string;
  [key: string]: string | string[] | boolean | undefined;
}

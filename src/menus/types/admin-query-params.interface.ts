export interface MenuAdminQueryParams {
  limit?: string;
  offset?: string;
  key?: string;
  domainId?: string;
  isGlobal?: string | boolean;
  [key: string]: string | string[] | boolean | undefined;
}

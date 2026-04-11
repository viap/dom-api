export interface PageQueryParams {
  domainId?: string;
  limit?: string;
  offset?: string;
  [key: string]: string | string[] | undefined;
}

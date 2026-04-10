export interface EventQueryParams {
  domainId?: string;
  limit?: string;
  offset?: string;
  [key: string]: string | string[] | undefined;
}

export interface EventQueryParams {
  domainId?: string;
  personId?: string;
  limit?: string;
  offset?: string;
  [key: string]: string | string[] | undefined;
}

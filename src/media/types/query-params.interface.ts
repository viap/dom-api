export interface MediaQueryParams {
  limit?: string;
  offset?: string;
  isPublished?: string;
  kind?: string;
  search?: string;
  [key: string]: string | string[] | undefined;
}

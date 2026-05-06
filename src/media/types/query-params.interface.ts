export interface MediaQueryParams {
  limit?: string;
  offset?: string;
  isPublished?: string;
  kind?: string;
  search?: string;
  folder?: string;
  [key: string]: string | string[] | undefined;
}

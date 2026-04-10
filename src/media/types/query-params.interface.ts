export interface MediaQueryParams {
  limit?: string;
  offset?: string;
  isPublished?: string;
  [key: string]: string | string[] | undefined;
}

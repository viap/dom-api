export interface LocationQueryParams {
  limit?: string;
  offset?: string;
  title?: string;
  city?: string;
  [key: string]: string | string[] | undefined;
}

export interface PersonQueryParams {
  limit?: string;
  offset?: string;
  fullName?: string;
  role?: string;
  [key: string]: string | string[] | undefined;
}

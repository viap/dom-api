export interface MediaAdminQueryParams {
  limit?: string;
  offset?: string;
  kind?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  [key: string]: string | string[] | undefined;
}

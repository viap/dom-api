export interface MediaAdminQueryParams {
  limit?: string;
  offset?: string;
  kind?: string;
  search?: string;
  folder?: string;
  createdFrom?: string;
  createdTo?: string;
  [key: string]: string | string[] | undefined;
}

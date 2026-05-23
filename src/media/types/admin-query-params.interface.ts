export interface MediaAdminQueryParams {
  limit?: string;
  offset?: string;
  isPublished?: string | boolean;
  kind?: string;
  search?: string;
  folder?: string;
  createdFrom?: string;
  createdTo?: string;
  [key: string]: string | string[] | boolean | undefined;
}

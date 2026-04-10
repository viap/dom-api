export interface ApplicationQueryParams {
  domainId?: string;
  formType?: string;
  status?: string;
  assignedTo?: string;
  limit?: string;
  offset?: string;
  [key: string]: string | string[] | undefined;
}

export interface PartnerQueryParams {
  limit?: string;
  offset?: string;
  title?: string;
  type?: string;
  [key: string]: string | string[] | undefined;
}

/**
 * Type definitions for therapy request query parameters
 */

export interface TherapyRequestQueryParams {
  accepted?: string | boolean;
  psychologist?: string;
  user?: string;
  status?: string;
  dateFrom?: string | number;
  dateTo?: string | number;
}

export interface TherapyRequestFilters {
  [key: string]: string | boolean | number | undefined;
  accepted?: boolean;
  psychologist?: string;
  user?: string;
}

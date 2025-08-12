/**
 * Common query parameter types for MongoDB operations
 */

export type PrimitiveValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type MongoQueryValue =
  | PrimitiveValue
  | PrimitiveValue[]
  | { [key: string]: PrimitiveValue | PrimitiveValue[] };

export interface QueryParams {
  [key: string]: MongoQueryValue;
}

export interface DateRangeParams {
  from?: string | number;
  to?: string | number;
}

export interface PaginationParams {
  page?: string | number;
  limit?: string | number;
  skip?: string | number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '1' | '-1';
}

export interface FilterParams extends QueryParams {
  search?: string;
  status?: string;
  type?: string;
}

export type SafeQueryParams = Record<string, PrimitiveValue | PrimitiveValue[]>;

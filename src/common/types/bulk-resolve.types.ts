export interface BulkIdsRequest {
  ids: string[];
}

export interface BulkResolveResponse<T> {
  items: T[];
}

import { BulkResolveResponse } from '../types/bulk-resolve.types';
import { validateObjectId } from './mongo-sanitizer';

type PreparedBulkIds = {
  uniqueIds: string[];
  validIds: string[];
  validIdByInput: Map<string, string>;
};

export function prepareBulkIds(ids: string[]): PreparedBulkIds {
  const uniqueIds: string[] = [];
  const validIds: string[] = [];
  const validIdByInput = new Map<string, string>();
  const seenValidIds = new Set<string>();

  for (const rawId of ids) {
    if (typeof rawId !== 'string') {
      continue;
    }

    const id = rawId.trim();
    if (!id) {
      continue;
    }

    const validId = validateObjectId(id);
    if (!validId) {
      continue;
    }

    const normalizedValidId = validId.toLowerCase();
    if (seenValidIds.has(normalizedValidId)) {
      continue;
    }

    uniqueIds.push(id);
    validIdByInput.set(id, normalizedValidId);
    seenValidIds.add(normalizedValidId);
    validIds.push(normalizedValidId);
  }

  return {
    uniqueIds,
    validIds,
    validIdByInput,
  };
}

export function toBulkResolveResponse<T>(params: {
  preparedIds: PreparedBulkIds;
  items: T[];
  getId: (item: T) => string;
}): BulkResolveResponse<T> {
  const { preparedIds, items, getId } = params;
  const byId = new Map<string, T>();

  for (const item of items) {
    const itemId = getId(item).toLowerCase();
    if (!byId.has(itemId)) {
      byId.set(itemId, item);
    }
  }

  const orderedItems: T[] = [];

  for (const inputId of preparedIds.uniqueIds) {
    const validId = preparedIds.validIdByInput.get(inputId);
    if (!validId) continue;

    const item = byId.get(validId);
    if (!item) continue;

    orderedItems.push(item);
  }

  return {
    items: orderedItems,
  };
}

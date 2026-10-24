export const ENTITY_COLLECTION_COLUMNS = ['auto', 2, 3, 4, 5] as const;

export type EntityCollectionColumns =
  (typeof ENTITY_COLLECTION_COLUMNS)[number];

export function isEntityCollectionColumns(
  value: unknown,
): value is EntityCollectionColumns {
  return ENTITY_COLLECTION_COLUMNS.some((column) => column === value);
}

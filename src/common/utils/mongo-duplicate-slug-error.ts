export type MongoDuplicateSlugError = {
  code: number;
  keyPattern?: {
    slug?: unknown;
  };
};

export function isMongoDuplicateSlugError(
  error: unknown,
): error is MongoDuplicateSlugError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (!('code' in error) || !('keyPattern' in error)) {
    return false;
  }

  const mongoError = error as MongoDuplicateSlugError;
  return mongoError.code === 11000 && !!mongoError.keyPattern?.slug;
}

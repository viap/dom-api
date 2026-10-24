import mongoose from 'mongoose';

export function getMongooseValidationErrorPaths(
  error: unknown,
): string[] | null {
  if (error instanceof mongoose.Error.ValidationError) {
    return [...new Set(Object.keys(error.errors))].sort();
  }

  if (
    error instanceof mongoose.Error.CastError ||
    error instanceof mongoose.Error.StrictModeError
  ) {
    return error.path ? [error.path] : [];
  }

  return null;
}

export function formatMongooseUpdateValidationError(
  error: unknown,
): string | null {
  const paths = getMongooseValidationErrorPaths(error);
  if (paths === null) {
    return null;
  }

  return paths.length > 0
    ? `Update validation failed: ${paths.join(', ')}`
    : 'Update validation failed';
}

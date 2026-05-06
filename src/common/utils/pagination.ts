export function parsePaginationLimit(value: unknown): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100) {
    return parsed;
  }

  return 20;
}

export function parsePaginationOffset(value: unknown): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return 0;
}

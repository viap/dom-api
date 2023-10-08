export function includesOther<T>(
  required: Array<T>,
  exists: Array<T>,
  excludes: Array<T>,
): boolean {
  const leftover: Array<T> = exists.filter(
    (value) => !excludes.includes(value),
  );

  return !!required.find((value) => {
    return leftover.includes(value);
  });
}

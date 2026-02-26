export const parseNumericValue = (
  value: Date | string | number | null,
  onlyPositive = false,
): number => {
  let num: number = undefined;
  switch (true) {
    case value instanceof Date:
      num = value.valueOf();
      break;

    case typeof value === 'number':
      num = value;
      break;

    default:
      num = parseInt(value);
  }

  return num < 0 && onlyPositive ? undefined : num;
};

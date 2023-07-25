export function addItems<T>(list: Array<T>, items: Array<T>) {
  const result = [...list];
  items.forEach((item) => {
    if (!result.includes(item)) {
      result.push(item);
    }
  });

  return result;
}

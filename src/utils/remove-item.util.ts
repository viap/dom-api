export function removeItems<T>(list: Array<T>, items: Array<T>) {
  const result = [...list];
  items.forEach((item) => {
    const index = result.findIndex((elem) => elem === item);
    if (index >= 0) {
      result.splice(index, 1);
    }
  });

  return result;
}

export default function groupBy<T>(
  items: Array<T> = [],
  callbackFn: (item: T) => string | number,
) {
  const result: { [key: string | number]: Array<T> } = {};

  items.forEach((item) => {
    const property = callbackFn(item);
    if (result[property]) {
      result[property].push(item);
    } else {
      result[property] = [item];
    }
  });

  return result;
}

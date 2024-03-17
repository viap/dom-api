export function parseRuDate(dateStr?: string): number {
  const dateRu = /([0-9]{2})\.([0-9]{2})\.([0-9]{4})/;

  if (dateStr && dateRu.test(dateStr)) {
    const matches = dateRu.exec(dateStr);

    return Date.parse(`${matches[3]}-${matches[2]}-${matches[1]}`);
  }

  return Date.parse(dateStr);
}

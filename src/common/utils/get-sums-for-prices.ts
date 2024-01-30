import { Price } from '../schemas/price.schema';
import groupBy from './group-by';

export function getSumsForPrices(prices: Array<Price>) {
  return Object.entries(groupBy(prices, (price) => price.currency)).map(
    ([currency, prices]) =>
      `${prices
        .map((price) => price.value)
        .reduce((sum, value) => sum + value, 0)} ${currency}`,
  );
}

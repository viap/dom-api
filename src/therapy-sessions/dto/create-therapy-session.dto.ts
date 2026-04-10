import { Price } from '@/common/schemas/price.schema';

export class CreateTherapySessionDto {
  dateTime?: number;
  client: string;
  psychologist: string;
  duration: number;
  price: Price;
  commission?: Price;
  descr?: string;
}

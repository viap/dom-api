import { Price } from 'src/common/schemas/price.schema';

export class CreateTherapySessionDto {
  date: string;
  client: string;
  psychologist: string;
  duration: number;
  price: Price;
  comission?: Price;
  descr?: string;
}

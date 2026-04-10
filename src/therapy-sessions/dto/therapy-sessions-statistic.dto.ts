import { Price } from '@/common/schemas/price.schema';
import { Psychologist } from '@/psychologists/schemas/psychologist.schema';
import { User } from '@/users/schemas/user.schema';

export class TherapySessionsControllerStatistic {
  client: User;
  psychologist: Psychologist;
  from: string;
  to: string;
  price: Array<Price>;
  commission: Array<Price>;
  countForPeriod: number;
  countAll: number;
}

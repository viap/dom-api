import { Price } from 'src/common/schemas/price.schema';
import { Psychologist } from 'src/psychologists/schemas/psychologist.schema';
import { User } from 'src/users/schemas/user.schema';

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

import { SetMetadata } from '@nestjs/common';

export const IS_MY_THERAPY_SESSIONS_KEY = 'isMyTherapySessions';
export const IsMyTherapySessions = () =>
  SetMetadata(IS_MY_THERAPY_SESSIONS_KEY, true);

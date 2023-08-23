import { SetMetadata } from '@nestjs/common';

export const IS_MY_DATA = 'isMyData';
export const IsMyData = () => SetMetadata(IS_MY_DATA, true);

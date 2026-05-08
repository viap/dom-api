import { UnauthorizedException } from '@nestjs/common';
import { AuthFailureReason } from '../enums/auth-failure-reason.enum';

export class AuthFailureError extends UnauthorizedException {
  constructor(public readonly reason: AuthFailureReason) {
    super();
  }
}

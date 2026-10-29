import { Global, Module } from '@nestjs/common';
import { ApplicationMessagingPolicyService } from './application-messaging-policy.service';

@Global()
@Module({
  providers: [ApplicationMessagingPolicyService],
  exports: [ApplicationMessagingPolicyService],
})
export class ApplicationMessagingPolicyModule {}

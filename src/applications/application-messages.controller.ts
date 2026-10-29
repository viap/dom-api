import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { GetUserContext } from '@/common/user-context/user-context.decorator';
import { UserContext } from '@/common/user-context/user-context.interface';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { ApplicationMessagesService } from './application-messages.service';
import {
  ClaimApplicationMessageDto,
  CreateApplicationMessageDto,
  ListApplicationMessageThreadsDto,
  ReceiveApplicationReplyDto,
  ReportApplicationMessageDto,
} from './dto/application-message.dto';
import {
  claimApplicationMessageSchema,
  createApplicationMessageSchema,
  listApplicationMessageThreadsSchema,
  receiveApplicationReplySchema,
  reportApplicationMessageSchema,
} from './schemas/joi.application-message.schema';
import { ApiClient } from '@/api-clients/decorators/api-client.decorator';

@Controller()
export class ApplicationMessagesController {
  constructor(
    private readonly applicationMessagesService: ApplicationMessagesService,
  ) {}

  @Get('applications/:applicationId/messages')
  @Roles(Role.Admin, Role.Editor)
  getThread(@Param('applicationId') applicationId: string) {
    return this.applicationMessagesService.getThread(applicationId);
  }

  @Post('applications/:applicationId/messages')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  createOutbound(
    @Param('applicationId') applicationId: string,
    @Body(new JoiValidationPipe(createApplicationMessageSchema))
    dto: CreateApplicationMessageDto,
    @GetUserContext() userContext: UserContext,
  ) {
    return this.applicationMessagesService.createOutbound(
      applicationId,
      dto,
      userContext,
    );
  }

  @Post('application-messages/claim')
  @Public()
  @ApiClient('BOT')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  claim(
    @Body(new JoiValidationPipe(claimApplicationMessageSchema))
    dto: ClaimApplicationMessageDto,
  ) {
    return this.applicationMessagesService.claimNext(dto);
  }

  @Post('application-messages/report')
  @Public()
  @ApiClient('BOT')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  report(
    @Body(new JoiValidationPipe(reportApplicationMessageSchema))
    dto: ReportApplicationMessageDto,
  ) {
    return this.applicationMessagesService.reportDelivery(dto);
  }

  @Post('application-messages/threads')
  @Public()
  @ApiClient('BOT')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  listThreads(
    @Body(new JoiValidationPipe(listApplicationMessageThreadsSchema))
    dto: ListApplicationMessageThreadsDto,
  ) {
    return this.applicationMessagesService.listThreads(dto);
  }

  @Post('application-messages/reply')
  @Public()
  @ApiClient('BOT')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  receiveReply(
    @Body(new JoiValidationPipe(receiveApplicationReplySchema))
    dto: ReceiveApplicationReplyDto,
  ) {
    return this.applicationMessagesService.receiveReply(dto);
  }
}

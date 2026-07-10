import { Body, Controller, Get, Param, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '@/common/user-context/user-context.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { UserDocument } from '@/users/schemas/user.schema';
import { UpdateTherapyRequestAnalyticsDto } from './dto/update-therapy-request-analytics.dto';
import { joiUpdateTherapyRequestAnalyticsSchema } from './schemas/joi.update-therapy-request-analytics.schema';
import { TherapyRequestAnalyticsService } from './therapy-request-analytics.service';
import { TherapyRequestsService } from './therapy-requests.service';
import {
  TherapyRequestAnalyticsFiltersResponse,
  TherapyRequestAnalyticsLifecycleResponse,
  TherapyRequestAnalyticsQuery,
  TherapyRequestAnalyticsRequestDetails,
  TherapyRequestAnalyticsRequestsResponse,
  TherapyRequestAnalyticsSummaryResponse,
} from './types/therapy-request-analytics.types';

@Controller('therapy-request-analytics')
@Roles(Role.Admin, Role.Editor)
export class TherapyRequestAnalyticsController {
  constructor(
    private analyticsService: TherapyRequestAnalyticsService,
    private therapyRequestsService: TherapyRequestsService,
  ) {}

  @Get('filters')
  @Roles(Role.Admin, Role.Editor)
  getFilters(): Promise<TherapyRequestAnalyticsFiltersResponse> {
    return this.analyticsService.getFilters();
  }

  @Get('summary')
  @Roles(Role.Admin, Role.Editor)
  getSummary(
    @Query() query: TherapyRequestAnalyticsQuery,
  ): Promise<TherapyRequestAnalyticsSummaryResponse> {
    return this.analyticsService.getSummary(query);
  }

  @Get('requests')
  @Roles(Role.Admin, Role.Editor)
  getRequests(
    @Query() query: TherapyRequestAnalyticsQuery,
  ): Promise<TherapyRequestAnalyticsRequestsResponse> {
    return this.analyticsService.getRequests(query);
  }

  @Get('requests/:therapyRequestId')
  @Roles(Role.Admin, Role.Editor)
  getRequestDetails(
    @Param('therapyRequestId') therapyRequestId: string,
  ): Promise<TherapyRequestAnalyticsRequestDetails> {
    return this.analyticsService.getRequestDetails(therapyRequestId);
  }

  @Get('lifecycle')
  @Roles(Role.Admin, Role.Editor)
  getLifecycle(
    @Query() query: TherapyRequestAnalyticsQuery,
  ): Promise<TherapyRequestAnalyticsLifecycleResponse> {
    return this.analyticsService.getLifecycle(query);
  }

  @Get('export')
  @Roles(Role.Admin, Role.Editor)
  async export(
    @Query() query: TherapyRequestAnalyticsQuery,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.analyticsService.exportXlsx(query);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="therapy-request-analytics.xlsx"',
    );
    response.send(buffer);
  }

  @Put('requests/:therapyRequestId')
  @Roles(Role.Admin, Role.Editor)
  updateRequestAnalytics(
    @Param('therapyRequestId') therapyRequestId: string,
    @GetUser() user: UserDocument,
    @Body(new JoiValidationPipe(joiUpdateTherapyRequestAnalyticsSchema))
    updateData: UpdateTherapyRequestAnalyticsDto,
  ) {
    return this.therapyRequestsService.updateAnalytics(
      therapyRequestId,
      updateData,
      user?._id?.toString(),
    );
  }
}

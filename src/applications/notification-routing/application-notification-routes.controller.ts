import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import {
  ApplicationNotificationEligibleUserDto,
  ApplicationNotificationRouteDto,
  UpdateApplicationNotificationRouteDto,
} from '@/applications/notification-routing/dto/application-notification-route.dto';
import { updateApplicationNotificationRouteSchema } from '@/applications/notification-routing/schemas/joi.update-application-notification-route.schema';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApplicationNotificationRoutesService } from './application-notification-routes.service';

@Controller('application-notification-routes')
@Roles(Role.Admin, Role.Editor)
export class ApplicationNotificationRoutesController {
  constructor(
    private readonly routesService: ApplicationNotificationRoutesService,
  ) {}

  @Get()
  getAll(): Promise<Array<ApplicationNotificationRouteDto>> {
    return this.routesService.getAll();
  }

  @Get('eligible-users')
  getEligibleUsers(): Promise<Array<ApplicationNotificationEligibleUserDto>> {
    return this.routesService.getEligibleUsers();
  }

  @Put(':formType')
  @Roles(Role.Admin)
  replace(
    @Param('formType') formType: ApplicationFormType,
    @Body(new JoiValidationPipe(updateApplicationNotificationRouteSchema))
    update: UpdateApplicationNotificationRouteDto,
  ): Promise<ApplicationNotificationRouteDto> {
    return this.routesService.replace(formType, update);
  }
}

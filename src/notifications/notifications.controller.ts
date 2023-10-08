import { Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';

@Controller('notifications')
@Roles(Role.Admin, Role.Editor)
export class NotificationsController {
  constructor(private notificationService: NotificationsService) {}

  @Get()
  getAll() {
    return this.notificationService.getAll();
  }

  @Get('user/:userId')
  getAllForUser(@Param('userId') userId: string) {
    return this.notificationService.getAllByUserId(userId);
  }

  @Post(':notificationId/user/:userId')
  addReceived(
    @Param('notificationId') notificationId: string,
    @Param('userId') userId: string,
  ): Promise<boolean> {
    return this.notificationService.addReceived(notificationId, userId);
  }
}

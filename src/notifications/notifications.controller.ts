import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@Roles(Role.Admin, Role.Editor)
export class NotificationsController {
  constructor(private notificationService: NotificationsService) {}

  @Get()
  getAll() {
    return this.notificationService.getAll();
  }

  @Get('users/:userId')
  getAllForUser(@Param('userId') userId: string) {
    return this.notificationService.getAllByUserId(userId);
  }

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @Post(':notificationId/add-received/:userId')
  addReceived(
    @Param('notificationId') notificationId: string,
    @Param('userId') userId: string,
  ): Promise<boolean> {
    return this.notificationService.addReceived(notificationId, userId);
  }
}

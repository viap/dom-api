import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsModule } from '@/domains/domains.module';
import { EventsModule } from '@/events/events.module';
import { PartnersModule } from '@/partners/partners.module';
import { PeopleModule } from '@/people/people.module';
import { ProgramsModule } from '@/programs/programs.module';
import { UsersModule } from '@/users/users.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { TelegramContactModule } from '@/telegram-contact/telegram-contact.module';
import { Application, applicationSchema } from './schemas/application.schema';
import {
  ApplicationMessage,
  applicationMessageSchema,
} from './schemas/application-message.schema';
import { ApplicationMessagesController } from './application-messages.controller';
import { ApplicationMessagesService } from './application-messages.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationContextResolver } from './application-context-resolver.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Application.name, schema: applicationSchema },
      { name: ApplicationMessage.name, schema: applicationMessageSchema },
    ]),
    DomainsModule,
    ProgramsModule,
    EventsModule,
    PartnersModule,
    PeopleModule,
    UsersModule,
    NotificationsModule,
    TelegramContactModule,
  ],
  controllers: [ApplicationsController, ApplicationMessagesController],
  providers: [
    ApplicationContextResolver,
    ApplicationsService,
    ApplicationMessagesService,
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Application,
  applicationSchema,
} from '@/applications/schemas/application.schema';
import { DomainsModule } from '@/domains/domains.module';
import { LocationsModule } from '@/locations/locations.module';
import { MediaModule } from '@/media/media.module';
import { PartnersModule } from '@/partners/partners.module';
import { PeopleModule } from '@/people/people.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { DomainEvent, domainEventSchema } from './schemas/domain-event.schema';

@Module({
  imports: [
    // Application schema imported directly (not via ApplicationsModule) to count
    // event registrations without a circular module dependency.
    MongooseModule.forFeature([
      { name: DomainEvent.name, schema: domainEventSchema },
      { name: Application.name, schema: applicationSchema },
    ]),
    DomainsModule,
    LocationsModule,
    MediaModule,
    PeopleModule,
    PartnersModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

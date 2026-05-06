import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
    MongooseModule.forFeature([
      { name: DomainEvent.name, schema: domainEventSchema },
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

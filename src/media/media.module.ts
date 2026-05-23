import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainEvent, domainEventSchema } from '@/events/schemas/domain-event.schema';
import { Page, pageSchema } from '@/pages/schemas/page.schema';
import { Partner, partnerSchema } from '@/partners/schemas/partner.schema';
import { Person, personSchema } from '@/people/schemas/person.schema';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media, mediaSchema } from './schemas/media.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Media.name, schema: mediaSchema },
      { name: Page.name, schema: pageSchema },
      { name: DomainEvent.name, schema: domainEventSchema },
      { name: Person.name, schema: personSchema },
      { name: Partner.name, schema: partnerSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '@/events/events.module';
import { DomainsModule } from '@/domains/domains.module';
import { MediaModule } from '@/media/media.module';
import { PartnersModule } from '@/partners/partners.module';
import { PeopleModule } from '@/people/people.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { Page, pageSchema } from './schemas/page.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Page.name, schema: pageSchema }]),
    DomainsModule,
    MediaModule,
    PeopleModule,
    PartnersModule,
    EventsModule,
  ],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsModule } from '@/domains/domains.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { Page, pageSchema } from './schemas/page.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Page.name, schema: pageSchema }]),
    DomainsModule,
  ],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}

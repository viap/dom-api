import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsModule } from '@/domains/domains.module';
import { PagesModule } from '@/pages/pages.module';
import { Menu, menuSchema } from './schemas/menu.schema';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Menu.name, schema: menuSchema }]),
    DomainsModule,
    PagesModule,
  ],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}

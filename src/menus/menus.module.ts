import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsModule } from '@/domains/domains.module';
import { PagesModule } from '@/pages/pages.module';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { Menu, menuSchema } from './schemas/menu.schema';

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

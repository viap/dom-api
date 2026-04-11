import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Domain, domainSchema } from '@/domains/schemas/domain.schema';
import { Page, pageSchema } from '@/pages/schemas/page.schema';
import { Menu, menuSchema } from './schemas/menu.schema';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Menu.name, schema: menuSchema },
      { name: Domain.name, schema: domainSchema },
      { name: Page.name, schema: pageSchema },
    ]),
  ],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaModule } from '@/media/media.module';
import { Partner, partnerSchema } from './schemas/partner.schema';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Partner.name, schema: partnerSchema }]),
    MediaModule,
  ],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}

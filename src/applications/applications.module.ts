import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsModule } from '@/domains/domains.module';
import { EventsModule } from '@/events/events.module';
import { PartnersModule } from '@/partners/partners.module';
import { ProgramsModule } from '@/programs/programs.module';
import { UsersModule } from '@/users/users.module';
import { Application, applicationSchema } from './schemas/application.schema';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Application.name, schema: applicationSchema },
    ]),
    DomainsModule,
    ProgramsModule,
    EventsModule,
    PartnersModule,
    UsersModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

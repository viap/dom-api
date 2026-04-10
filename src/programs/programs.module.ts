import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainsModule } from '@/domains/domains.module';
import { PartnersModule } from '@/partners/partners.module';
import { PeopleModule } from '@/people/people.module';
import { Program, programSchema } from './schemas/program.schema';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Program.name, schema: programSchema }]),
    DomainsModule,
    PeopleModule,
    PartnersModule,
  ],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaModule } from '@/media/media.module';
import { UsersModule } from '@/users/users.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { Person, personSchema } from './schemas/person.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Person.name, schema: personSchema }]),
    UsersModule,
    MediaModule,
  ],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}

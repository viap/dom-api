import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TelegramContactSession,
  telegramContactSessionSchema,
} from '@/telegram-contact/schemas/telegram-contact-session.schema';
import {
  TelegramIdentity,
  telegramIdentitySchema,
} from '@/telegram-contact/schemas/telegram-identity.schema';
import {
  TelegramLinkSession,
  telegramLinkSessionSchema,
} from '@/telegram-contact/schemas/telegram-link-session.schema';
import { TelegramContactController } from '@/telegram-contact/telegram-contact.controller';
import { TelegramContactService } from '@/telegram-contact/telegram-contact.service';
import { UsersModule } from '@/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TelegramIdentity.name, schema: telegramIdentitySchema },
      { name: TelegramLinkSession.name, schema: telegramLinkSessionSchema },
      {
        name: TelegramContactSession.name,
        schema: telegramContactSessionSchema,
      },
    ]),
    UsersModule,
  ],
  controllers: [TelegramContactController],
  providers: [TelegramContactService],
  exports: [TelegramContactService],
})
export class TelegramContactModule {}

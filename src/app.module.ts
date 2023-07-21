import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ApiClientsModule } from './apiClients/api-clients.module';
import { PsychologistModule } from './psychologists/psychologists.module';
import { RolesGuard } from './roles/roles.guard';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { ParticipantsModule } from './participants/participants.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017', {
      dbName: 'domData',
      user: 'root',
      pass: 'example',
    }),
    UsersModule,
    AuthModule,
    ApiClientsModule,
    RolesModule,
    PsychologistModule,
    ParticipantsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

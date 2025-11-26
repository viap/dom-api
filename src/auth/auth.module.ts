import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ApiClientsModule } from 'src/api-clients/api-clients.module';
import { UsersModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    ApiClientsModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET environment variable is required but not set. ' +
              'Please set a strong secret (minimum 32 characters) in your environment variables.',
          );
        }

        if (secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be at least 32 characters long for security. ' +
              'Current length: ' +
              secret.length,
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: '1d',
            algorithm: 'HS256',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

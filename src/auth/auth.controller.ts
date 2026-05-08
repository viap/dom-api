import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { normalizeLogin } from '@/common/utils/normalize-login';
import { GetUserContext } from '../common/user-context/user-context.decorator';
import { UserContext } from '../common/user-context/user-context.interface';
import { AuthLoginAttemptsService } from './auth-login-attempts.service';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { AuthByTelegramDto } from './dto/auth-by-telegram.dto';
import { AuthByUserDto } from './dto/auth-by-user.dto';
import { AuthFailureError } from './errors/auth-failure.error';
import { AuthFailureReason } from './enums/auth-failure-reason.enum';
import { joiAuthByTelegramSchema } from './schemas/joi.auth-by-telegram.schema';
import { joiAuthByUserSchema } from './schemas/joi.auth-by-user.schema';
import { AuthRequestMetadata } from './types/auth-request-metadata.interface';
import { randomUUID } from 'crypto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authLoginAttemptsService: AuthLoginAttemptsService,
  ) {}

  @Public()
  @Post('login/telegram')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(joiAuthByTelegramSchema))
  async getAuthTokenForTelegram(
    @Body() data: AuthByTelegramDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-request-id') requestIdHeader?: string,
  ) {
    const normalizedTelegramId = this.normalizeTelegramId(data.telegram?.id);
    const metadata = this.getRequestMetadata(
      request,
      requestIdHeader,
      normalizedTelegramId,
      data.apiClient?.name,
    );

    const lockedState = this.authLoginAttemptsService.getLockedState(
      metadata.sourceIp,
      normalizedTelegramId,
    );

    if (normalizedTelegramId && lockedState.locked) {
      this.authService.logAuthFailure({
        reason: AuthFailureReason.InvalidUserCredentials,
        metadata,
        locked: true,
      });
      this.throwTooManyAttempts(response, lockedState.retryAfterSeconds);
    }

    try {
      const token = await this.authService.signInByTelegram(
        data.apiClient,
        data.telegram,
        metadata,
      );
      if (normalizedTelegramId) {
        this.authLoginAttemptsService.reset(
          metadata.sourceIp,
          normalizedTelegramId,
        );
      }
      return token;
    } catch (error) {
      if (error instanceof AuthFailureError && normalizedTelegramId) {
        const attempt = this.authLoginAttemptsService.registerFailure(
          metadata.sourceIp,
          normalizedTelegramId,
        );
        if (attempt.locked) {
          this.authService.logAuthFailure({
            reason: AuthFailureReason.InvalidUserCredentials,
            metadata,
            locked: true,
          });
        }
      }
      throw error;
    }
  }

  @Public()
  @Post('login/user')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(joiAuthByUserSchema))
  async getAuthTokenForUser(
    @Body() data: AuthByUserDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('x-request-id') requestIdHeader?: string,
  ) {
    const normalizedLogin = normalizeLogin(data.user?.login);
    const metadata = this.getRequestMetadata(
      request,
      requestIdHeader,
      normalizedLogin,
      data.apiClient?.name,
    );

    const lockedState = this.authLoginAttemptsService.getLockedState(
      metadata.sourceIp,
      normalizedLogin,
    );

    if (normalizedLogin && lockedState.locked) {
      this.authService.logAuthFailure({
        reason: AuthFailureReason.InvalidUserCredentials,
        metadata,
        locked: true,
      });
      this.throwTooManyAttempts(response, lockedState.retryAfterSeconds);
    }

    try {
      const token = await this.authService.signInByAuthUser(
        data.apiClient,
        data.user,
        metadata,
      );
      if (normalizedLogin) {
        this.authLoginAttemptsService.reset(metadata.sourceIp, normalizedLogin);
      }
      return token;
    } catch (error) {
      if (error instanceof AuthFailureError) {
        if (
          error.reason === AuthFailureReason.InvalidUserCredentials &&
          normalizedLogin
        ) {
          const attempt = this.authLoginAttemptsService.registerFailure(
            metadata.sourceIp,
            normalizedLogin,
          );

          if (attempt.locked) {
            this.authService.logAuthFailure({
              reason: AuthFailureReason.InvalidUserCredentials,
              metadata,
              locked: true,
            });
          }
        }
      }
      throw error;
    }
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  refreshToken(@GetUserContext() userContext: UserContext) {
    return this.authService.refreshToken(userContext);
  }

  @Get('check-token')
  @HttpCode(HttpStatus.OK)
  checkToken(): boolean {
    // NOTICE: the token itself checks in the auth guard
    return true;
  }

  @Public()
  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping(): string {
    return 'pong';
  }

  private getRequestMetadata(
    request: Request,
    requestIdHeader?: string,
    normalizedLogin?: string,
    clientName?: string,
  ): AuthRequestMetadata {
    const sourceIp = request.ip || request.socket?.remoteAddress || 'unknown';

    const userAgent = this.readHeaderValue(request.headers['user-agent']);

    return {
      requestId: this.sanitizeRequestId(requestIdHeader),
      sourceIp,
      userAgent,
      normalizedLogin,
      clientName,
    };
  }

  private readHeaderValue(value: string | string[] | undefined): string {
    if (!value) {
      return '';
    }
    return Array.isArray(value) ? value[0] || '' : value;
  }

  private sanitizeRequestId(value?: string): string {
    if (value && UUID_REGEX.test(value)) {
      return value;
    }
    return randomUUID();
  }

  private normalizeTelegramId(value: string | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private throwTooManyAttempts(
    response: Response,
    retryAfterSeconds: number | undefined,
  ): never {
    if (retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(retryAfterSeconds));
    }
    throw new HttpException(
      {
        message: 'Too many failed attempts',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

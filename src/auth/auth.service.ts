import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import { ApiClientsService } from '@/api-clients/api-clients.service';
import { ApiClientDto } from '@/api-clients/dto/api-client.dto';
import { normalizeLogin } from '@/common/utils/normalize-login';
import { UsersService } from '@/users/users.service';
import { UserContext } from '../common/user-context/user-context.interface';
import { AuthUserDto } from './dto/auth-user.dto';
import { TelegramUserDto } from './dto/telegram.dto';
import { AuthFailureError } from './errors/auth-failure.error';
import { AuthFailureReason } from './enums/auth-failure-reason.enum';
import {
  AuthFailureLogContext,
  AuthRequestMetadata,
} from './types/auth-request-metadata.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private clientService: ApiClientsService,
    private jwtService: JwtService,
    private userService: UsersService,
  ) {}

  async verifyToken(token: string): Promise<UserContext | undefined> {
    return await this.jwtService.verifyAsync(token).catch(() => undefined);
  }

  async decode(
    token: string,
  ): Promise<Record<string, unknown> | string | null> {
    return this.jwtService.decode(token);
  }

  isAvailableClient(initClient: ApiClientDto): boolean {
    const apiClient = this.clientService.findOne(initClient.name);

    if (!apiClient?.password) {
      return false;
    }

    return this.isSameSecret(apiClient.password, initClient.password || '');
  }

  async signInByTelegram(
    initClient: ApiClientDto,
    telegram: TelegramUserDto,
    metadata?: AuthRequestMetadata,
  ): Promise<{ auth_token: string }> | never {
    const authMetadata = this.buildAuthMetadata(metadata, {
      normalizedLogin: metadata?.normalizedLogin,
      clientName: initClient?.name || metadata?.clientName,
    });

    if (!this.isAvailableClient(initClient)) {
      this.logAuthFailure({
        reason: AuthFailureReason.InvalidApiClient,
        metadata: authMetadata,
      });
      throw new AuthFailureError(AuthFailureReason.InvalidApiClient);
    }

    const user =
      (await this.userService.getByTelegramId(telegram.id)) ||
      (await this.userService.createFromTelegram(telegram));

    const payload: UserContext = {
      userId: user._id.toString(),
      roles: user.roles,
      clientName: initClient.name,
    };

    return { auth_token: await this.jwtService.signAsync(payload) };
  }

  async signInByAuthUser(
    initClient: ApiClientDto,
    authUser: AuthUserDto,
    metadata?: AuthRequestMetadata,
  ): Promise<{ auth_token: string }> | never {
    const normalizedLogin = normalizeLogin(authUser?.login);
    const authMetadata = this.buildAuthMetadata(metadata, {
      normalizedLogin: metadata?.normalizedLogin || normalizedLogin,
      clientName: initClient?.name || metadata?.clientName,
    });

    if (!this.isAvailableClient(initClient)) {
      this.logAuthFailure({
        reason: AuthFailureReason.InvalidApiClient,
        metadata: authMetadata,
      });
      throw new AuthFailureError(AuthFailureReason.InvalidApiClient);
    }

    const user = await this.userService.getByAuthUser(authUser);

    if (!user) {
      this.logAuthFailure({
        reason: AuthFailureReason.InvalidUserCredentials,
        metadata: authMetadata,
      });
      throw new AuthFailureError(AuthFailureReason.InvalidUserCredentials);
    }

    const payload: UserContext = {
      userId: user._id.toString(),
      roles: user.roles,
      clientName: initClient.name,
    };

    return { auth_token: await this.jwtService.signAsync(payload) };
  }

  async refreshToken(userContext?: UserContext) {
    const user = await this.userService.getById(userContext.userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    const tokenPayload: UserContext = {
      ...userContext,
      roles: user.roles,
    };

    return { auth_token: await this.jwtService.signAsync(tokenPayload) };
  }

  logAuthFailure(context: AuthFailureLogContext): void {
    const { reason, metadata, locked = false } = context;
    const loginFingerprint = metadata.normalizedLogin
      ? this.getLoginFingerprint(metadata.normalizedLogin)
      : undefined;

    this.logger.warn(
      JSON.stringify({
        event: 'auth.login.failure',
        reason,
        requestId: metadata.requestId,
        sourceIp: metadata.sourceIp,
        userAgent: metadata.userAgent,
        clientName: metadata.clientName,
        loginFingerprint,
        locked,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  private getLoginFingerprint(normalizedLogin: string): string {
    return createHash('sha256')
      .update(normalizedLogin)
      .digest('hex')
      .slice(0, 16);
  }

  private buildAuthMetadata(
    metadata: AuthRequestMetadata | undefined,
    overrides: Partial<AuthRequestMetadata>,
  ): AuthRequestMetadata {
    return {
      requestId: metadata?.requestId || 'unknown',
      sourceIp: metadata?.sourceIp || 'unknown',
      userAgent: metadata?.userAgent,
      normalizedLogin: metadata?.normalizedLogin,
      clientName: metadata?.clientName,
      ...overrides,
    };
  }

  private isSameSecret(left: string, right: string): boolean {
    const leftDigest = createHash('sha256').update(left).digest();
    const rightDigest = createHash('sha256').update(right).digest();

    return timingSafeEqual(
      new Uint8Array(leftDigest),
      new Uint8Array(rightDigest),
    );
  }
}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import {
  ConfirmTelegramLinkDto,
  CreateTelegramLinkDto,
  ExchangeTelegramLinkDto,
  TelegramContactSessionDto,
} from '@/telegram-contact/dto/telegram-contact.dto';
import {
  confirmTelegramLinkSchema,
  createTelegramLinkSchema,
  exchangeTelegramLinkSchema,
  telegramContactSessionSchema,
} from '@/telegram-contact/schemas/joi.telegram-contact.schema';
import { TelegramContactService } from '@/telegram-contact/telegram-contact.service';

@Controller('telegram-contact')
export class TelegramContactController {
  constructor(
    private readonly telegramContactService: TelegramContactService,
  ) {}

  @Post('link')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  createLink(
    @Body(new JoiValidationPipe(createTelegramLinkSchema))
    dto: CreateTelegramLinkDto,
  ) {
    return this.telegramContactService.createLink(dto.apiClient);
  }

  @Post('link/confirm')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  confirmLink(
    @Body(new JoiValidationPipe(confirmTelegramLinkSchema))
    dto: ConfirmTelegramLinkDto,
  ) {
    return this.telegramContactService.confirmLink(dto);
  }

  @Post('link/status')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  exchangeLink(
    @Body(new JoiValidationPipe(exchangeTelegramLinkSchema))
    dto: ExchangeTelegramLinkDto,
  ) {
    return this.telegramContactService.exchangeLink(dto);
  }

  @Post('session')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  getSession(
    @Body(new JoiValidationPipe(telegramContactSessionSchema))
    dto: TelegramContactSessionDto,
  ) {
    return this.telegramContactService.getSession(
      dto.apiClient,
      dto.sessionToken,
    );
  }

  @Post('forget')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  forgetSession(
    @Body(new JoiValidationPipe(telegramContactSessionSchema))
    dto: TelegramContactSessionDto,
  ) {
    return this.telegramContactService.forgetSession(
      dto.apiClient,
      dto.sessionToken,
    );
  }
}

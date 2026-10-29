import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import {
  CancelTelegramLinkDto,
  ConfirmTelegramLinkDto,
  CreateTelegramLinkDto,
  ExchangeTelegramLinkDto,
  TelegramContactSessionDto,
} from '@/telegram-contact/dto/telegram-contact.dto';
import {
  cancelTelegramLinkSchema,
  confirmTelegramLinkSchema,
  createTelegramLinkSchema,
  exchangeTelegramLinkSchema,
  telegramContactSessionSchema,
} from '@/telegram-contact/schemas/joi.telegram-contact.schema';
import { TelegramContactService } from '@/telegram-contact/telegram-contact.service';
import { ApiClient } from '@/api-clients/decorators/api-client.decorator';

@Controller('telegram-contact')
export class TelegramContactController {
  constructor(
    private readonly telegramContactService: TelegramContactService,
  ) {}

  @Post('link')
  @Public()
  @ApiClient('WEB')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  createLink(
    @Body(new JoiValidationPipe(createTelegramLinkSchema))
    _dto: CreateTelegramLinkDto,
  ) {
    void _dto;
    return this.telegramContactService.createLink();
  }

  @Post('link/confirm')
  @Public()
  @ApiClient('BOT')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  confirmLink(
    @Body(new JoiValidationPipe(confirmTelegramLinkSchema))
    dto: ConfirmTelegramLinkDto,
  ) {
    return this.telegramContactService.confirmLink(dto);
  }

  @Post('link/cancel')
  @Public()
  @ApiClient('BOT')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  cancelLink(
    @Body(new JoiValidationPipe(cancelTelegramLinkSchema))
    dto: CancelTelegramLinkDto,
  ) {
    return this.telegramContactService.cancelLink(dto.startToken);
  }

  @Post('link/status')
  @Public()
  @ApiClient('WEB')
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
  @ApiClient('WEB')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  getSession(
    @Body(new JoiValidationPipe(telegramContactSessionSchema))
    dto: TelegramContactSessionDto,
  ) {
    return this.telegramContactService.getSession(dto.sessionToken);
  }

  @Post('forget')
  @Public()
  @ApiClient('WEB')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  forgetSession(
    @Body(new JoiValidationPipe(telegramContactSessionSchema))
    dto: TelegramContactSessionDto,
  ) {
    return this.telegramContactService.forgetSession(dto.sessionToken);
  }
}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Client } from 'src/clients/clients.service';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  checkAuthToken(@Body() data: Omit<Client, 'id'>) {
    return this.authService.signIn(data.name, data.password);
  }
}

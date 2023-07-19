import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.Admin, Role.Editor)
  @Get()
  getAll(): Promise<Array<User>> {
    return this.usersService.getAll();
  }

  @Roles(Role.Admin, Role.Editor)
  @Get(':id')
  getOne(@Param('id') id: string): Promise<User> {
    return this.usersService.getById(id);
  }

  @Roles(Role.Admin, Role.Editor)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() user: CreateUserDto): Promise<User> {
    return this.usersService.create(user);
  }

  @Roles(Role.Admin, Role.Editor)
  @Put(':id')
  update(@Param('id') id: string, @Body() user: UpdateUserDto): Promise<User> {
    return this.usersService.update(id, user);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id): Promise<User> {
    return this.usersService.remove(id);
  }
}

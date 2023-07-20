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
  UsePipes,
} from '@nestjs/common';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';
import { CreateUserDto, createUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, updateUserSchema } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin, Role.Editor)
  getAll(): Promise<Array<User>> {
    return this.usersService.getAll();
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Editor)
  getOne(@Param('id') id: string): Promise<User> {
    return this.usersService.getById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(createUserSchema))
  create(@Body() user: CreateUserDto): Promise<User> {
    return this.usersService.create(user);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateUserSchema)) user: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, user);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<User> {
    return this.usersService.remove(id);
  }
}

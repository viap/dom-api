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
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { currentUserAlias } from 'src/common/const/current-user-alias';
import { GetUser } from 'src/common/user-context/user-context.decorator';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { UserContextInterceptor } from '../common/user-context/user-context.interceptor';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { joiCreateUserSchema } from './schemas/joi.create-user.schema';
import { joiUpdateUserSchema } from './schemas/joi.update-user.schema';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';
import {
  transformUserToDto,
  transformUsersToDto,
} from './utils/user.transformer';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin, Role.Editor)
  async getAll(): Promise<Array<UserResponseDto>> {
    const users = await this.usersService.getAll();
    return transformUsersToDto(users);
  }

  @Get(currentUserAlias)
  @UseInterceptors(UserContextInterceptor)
  getMe(@GetUser() user: UserDocument): UserResponseDto {
    return transformUserToDto(user);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Editor)
  async getOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.getById(id);
    return transformUserToDto(user);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(joiCreateUserSchema))
  async create(@Body() createData: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createData);
    return transformUserToDto(user);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Editor)
  async update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(joiUpdateUserSchema)) updateData: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, updateData);
    return transformUserToDto(user);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<UserDocument | null> {
    return this.usersService.remove(id);
  }
}

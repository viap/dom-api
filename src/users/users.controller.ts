import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { currentUserAlias } from '@/common/const/current-user-alias';
import {
  GetUser,
  GetUserContext,
} from '@/common/user-context/user-context.decorator';
import { UserContext } from '@/common/user-context/user-context.interface';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
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

const ADMIN_ONLY_USER_FIELDS = ['roles', 'login', 'password'];
const PRIVILEGED_ROLES = [Role.Admin, Role.Editor];

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
  async create(
    @GetUserContext() actor: UserContext,
    @Body(new JoiValidationPipe(joiCreateUserSchema)) createData: CreateUserDto,
  ): Promise<UserResponseDto> {
    await this.assertCanManageUser(actor, createData);
    const user = await this.usersService.create(createData);
    return transformUserToDto(user);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Editor)
  async update(
    @GetUserContext() actor: UserContext,
    @Param('id') id: string,
    @Body(new JoiValidationPipe(joiUpdateUserSchema)) updateData: UpdateUserDto,
  ): Promise<UserResponseDto> {
    await this.assertCanManageUser(actor, updateData, id);
    const user = await this.usersService.update(id, updateData);
    return transformUserToDto(user);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<UserDocument | null> {
    return this.usersService.remove(id);
  }

  // Only admins manage privileges and credentials; editors may edit ordinary
  // profile fields of non-privileged users.
  private async assertCanManageUser(
    actor: UserContext | null,
    data: object,
    targetId?: string,
  ): Promise<void> {
    if (actor?.roles?.includes(Role.Admin)) {
      return;
    }

    if (ADMIN_ONLY_USER_FIELDS.some((field) => field in data)) {
      throw new ForbiddenException();
    }

    if (targetId) {
      const target = await this.usersService.getById(targetId);
      if (target?.roles?.some((role) => PRIVILEGED_ROLES.includes(role))) {
        throw new ForbiddenException();
      }
    }
  }
}

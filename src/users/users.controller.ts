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
  Request,
  UsePipes,
} from '@nestjs/common';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';
import { joiUpdateUserSchema } from './schemas/joi.update-user.schema';
import { joiCreateUserSchema } from './schemas/joi.create-user.schema';
import { currentUserAlias } from 'src/common/const/current-user-alias';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin, Role.Editor)
  getAll(): Promise<Array<UserDocument>> {
    return this.usersService.getAll();
  }

  @Get(currentUserAlias)
  getMe(@Request() req): UserDocument {
    const user = req.user as UserDocument;
    return user;
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Editor)
  getOne(@Param('id') id: string): Promise<UserDocument> {
    return this.usersService.getById(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(joiCreateUserSchema))
  create(@Body() createData: CreateUserDto): Promise<UserDocument> {
    return this.usersService.create(createData);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(joiUpdateUserSchema)) updateData: UpdateUserDto,
  ): Promise<UserDocument> {
    return this.usersService.update(id, updateData);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<UserDocument | null> {
    return this.usersService.remove(id);
  }
}

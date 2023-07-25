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
import { UserDocument } from 'src/users/schemas/user.schema';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import { PsychologistsService } from './psychologists.service';
import { PsychologistDocument } from './schemas/psychologist.schema';
import { joiCreatePsychologistSchema } from './schemas/joi.create-psychologist.schema';
import { joiUpdatePsychologistSchema } from './schemas/joi.update-psychologist.schema';

@Controller('psychologists')
@Roles(Role.Admin, Role.Editor)
export class PsychologistsController {
  constructor(private readonly psychologistService: PsychologistsService) {}

  @Get()
  async getAll(): Promise<Array<UserDocument>> {
    return this.psychologistService.getAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<UserDocument> {
    return this.psychologistService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(joiCreatePsychologistSchema))
  async create(
    @Body() createData: CreatePsychologistDto,
  ): Promise<UserDocument> {
    return this.psychologistService.create(createData);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(joiUpdatePsychologistSchema))
    updateData: UpdatePsychologistDto,
  ): Promise<PsychologistDocument> {
    return this.psychologistService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async remove(@Param('id') id: string): Promise<PsychologistDocument> {
    return this.psychologistService.remove(id);
  }
}

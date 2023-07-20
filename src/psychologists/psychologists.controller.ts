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
import {
  CreatePsychologistDto,
  createPsychologistSchema,
} from './dto/create-psychologist.dto';
import {
  UpdatePsychologistDto,
  updatePsychologistSchema,
} from './dto/update-psychologist.dto';
import { PsychologistsService } from './psychologists.service';
import { Psychologist } from './schemas/psychologist.schema';

@Controller('psychologists')
@Roles(Role.Admin, Role.Editor)
export class PsychologistsController {
  constructor(private readonly psychologistService: PsychologistsService) {}

  @Get()
  getAll(): Promise<Array<Psychologist>> {
    return this.psychologistService.getAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.psychologistService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(createPsychologistSchema))
  create(@Body() createData: CreatePsychologistDto): Promise<Psychologist> {
    return this.psychologistService.create(createData);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updatePsychologistSchema))
    updateData: UpdatePsychologistDto,
  ): Promise<Psychologist> {
    return this.psychologistService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  remove(@Param('id') id: string) {
    return this.psychologistService.remove(id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UsePipes,
} from '@nestjs/common';
import {
  CreateTherapySessionDto,
  createTherapySessionSchema,
} from './dto/create-therapy-session.dto';
import {
  UpdateTherapySessionDto,
  updateTherapySessionSchema,
} from './dto/update-therapy-session.dto';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';

@Controller('therapy-sessions')
@Roles(Role.Admin, Role.Editor, Role.Psychologist)
export class TherapySessionsController {
  @Get()
  @Roles(Role.Admin)
  getAll() {
    return [];
  }

  @Get('/psychologist/:id')
  getAllForPsychologist(@Param('id') id: string) {
    return [];
  }

  @Get('/psychologist/:id/participant/:clientId')
  getAllForPsychologistAndClient(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
  ) {
    return [];
  }

  @Post()
  @UsePipes(new JoiValidationPipe(createTherapySessionSchema))
  create(@Body() createData: CreateTherapySessionDto) {
    return JSON.stringify(createData);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateTherapySessionSchema))
    updateData: UpdateTherapySessionDto,
  ) {
    return id + ' -> ' + JSON.stringify(updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return id;
  }
}

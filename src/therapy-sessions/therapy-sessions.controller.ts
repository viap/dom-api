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
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { UpdateTherapySessionDto } from './dto/update-therapy-session.dto';
import { joiCreateTherapySessionSchema } from './schemas/joi.create-therapy-session.schema';
import { joiUpdateTherapySessionSchema } from './schemas/joi.update-therapy-session.schema';
import { TherapySessionDocument } from './schemas/therapy-session.schema';
import { TherapySessionsService } from './therapy-sessions.service';

@Controller('therapy-sessions')
@Roles(Role.Admin, Role.Editor, Role.Psychologist)
export class TherapySessionsController {
  constructor(private therapySessionService: TherapySessionsService) {}

  @Get()
  @Roles(Role.Admin)
  getAll(): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionService.getAll();
  }

  @Get('/psychologist/:id')
  getAllForPsychologist(
    @Param('id') psychologistId: string,
  ): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionService.getAllForPsychologist(psychologistId);
  }

  @Get('/psychologist/:id/client/:clientId')
  getAllForPsychologistAndClient(
    @Param('id') psychologistId: string,
    @Param('clientId') clientId: string,
  ): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionService.getAllForPsychologistAndClient(
      psychologistId,
      clientId,
    );
  }

  @Post()
  @UsePipes(new JoiValidationPipe(joiCreateTherapySessionSchema))
  create(
    @Body() createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    return this.therapySessionService.create(createData);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(joiUpdateTherapySessionSchema))
    updateData: UpdateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    return this.therapySessionService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<TherapySessionDocument | null> {
    return this.therapySessionService.remove(id);
  }
}

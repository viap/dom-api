import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';
import { IsMyTherapySessions } from './decorators/is-my-therapy-session.decorator';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { UpdateTherapySessionDto } from './dto/update-therapy-session.dto';
import { joiCreateTherapySessionSchema } from './schemas/joi.create-therapy-session.schema';
import { joiUpdateTherapySessionSchema } from './schemas/joi.update-therapy-session.schema';
import { TherapySessionDocument } from './schemas/therapy-session.schema';
import { TherapySessionsGuard } from './therapy-sessions.guard';
import { TherapySessionsService } from './therapy-sessions.service';

@Controller('therapy-sessions')
@Roles(Role.Admin, Role.Editor, Role.Psychologist)
@UseGuards(TherapySessionsGuard)
export class TherapySessionsController {
  constructor(private therapySessionService: TherapySessionsService) {}

  @Get()
  @Roles(Role.Admin)
  getAll(): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionService.getAll();
  }

  @Get(':sessionId')
  @IsMyTherapySessions()
  getById(
    @Param('sessionId') sessionId: string,
  ): Promise<TherapySessionDocument> {
    return this.therapySessionService.getById(sessionId);
  }

  // NOTICE: '.../psychologist/me' is using for data access for current user therapy sessions
  @Get('/psychologist/:psychologistId')
  @IsMyTherapySessions()
  getAllForPsychologist(
    @Request() req,
  ): Promise<Array<TherapySessionDocument>> {
    if (req.psychologist) {
      const psychologistId = (
        req.psychologist as PsychologistDocument
      )._id.toString();
      return this.therapySessionService.getAllForPsychologist(psychologistId);
    }
  }

  @Get('/psychologist/:psychologistId/client/:clientId')
  @IsMyTherapySessions()
  getAllForPsychologistAndClient(
    @Request() req,
    @Param('clientId') clientId: string,
  ): Promise<Array<TherapySessionDocument>> {
    if (req.psychologist) {
      const psychologistId = (
        req.psychologist as PsychologistDocument
      )._id.toString();
      return this.therapySessionService.getAllForPsychologistAndClient(
        psychologistId,
        clientId,
      );
    }
  }

  @Post()
  @UsePipes(new JoiValidationPipe(joiCreateTherapySessionSchema))
  create(
    @Body() createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    return this.therapySessionService.create(createData);
  }

  @Put(':sessionId')
  @Roles(Role.Admin, Role.Editor, Role.Psychologist)
  @IsMyTherapySessions()
  update(
    @Param('sessionId') sessionId: string,
    @Body(new JoiValidationPipe(joiUpdateTherapySessionSchema))
    updateData: UpdateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    return this.therapySessionService.update(sessionId, updateData);
  }

  @Delete(':sessionId')
  @IsMyTherapySessions()
  remove(
    @Param('sessionId') sessionId: string,
  ): Promise<TherapySessionDocument | null> {
    return this.therapySessionService.remove(sessionId);
  }
}

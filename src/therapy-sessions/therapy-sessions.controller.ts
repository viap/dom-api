import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { currentUserAlias } from 'src/common/const/current-user-alias';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { EnhancedRequest } from '../common/types/enhanced-request.interface';
import { IsMyTherapySessions } from './decorators/is-my-therapy-session.decorator';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { TherapySessionsControllerStatistic } from './dto/therapy-sessions-statistic.dto';
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

  @Post('/update/date-time')
  @Roles(Role.Admin)
  updateDateTime(): Promise<boolean> {
    return this.therapySessionService.migration_addDateTime();
  }

  @Get('/from/:from/to/:to')
  @IsMyTherapySessions()
  getAllForPeriod(
    @Param('from', new ParseIntPipe()) from: number,
    @Param('to', new ParseIntPipe()) to: number,
  ): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionService.getAll(from, to);
  }

  @Get('/statistic/from/:from/to/:to')
  @IsMyTherapySessions()
  getStatisticForPeriod(
    @Param('from', new ParseIntPipe()) from: number,
    @Param('to', new ParseIntPipe()) to: number,
  ): Promise<Array<TherapySessionsControllerStatistic>> {
    return this.therapySessionService.getStatisticForPeriod(from, to);
  }

  @Get('/statistic/psychologist/:psychologistId/from/:from/to/:to')
  @IsMyTherapySessions()
  getStatisticForPsychologistForPeriod(
    @Param('psychologistId') psychologistId: string,
    @Param('from', new ParseIntPipe()) from: number,
    @Param('to', new ParseIntPipe()) to: number,
  ): Promise<Array<TherapySessionsControllerStatistic>> {
    return this.therapySessionService.getStatisticForPeriod(
      from,
      to,
      psychologistId,
    );
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
    @Request() request: EnhancedRequest,
  ): Promise<Array<TherapySessionDocument>> {
    if (request.psychologistContext) {
      return this.therapySessionService.getAllForPsychologist(
        request.psychologistContext.id,
      );
    }
  }

  @Get('/psychologist/:psychologistId/from/:from/to/:to')
  @IsMyTherapySessions()
  getAllForPsychologistForPeriod(
    @Request() request: EnhancedRequest,
    @Param('from', new ParseIntPipe()) from: number,
    @Param('to', new ParseIntPipe()) to: number,
  ): Promise<Array<TherapySessionDocument>> {
    if (request.psychologistContext) {
      return this.therapySessionService.getAllForPsychologist(
        request.psychologistContext.id,
        from,
        to,
      );
    }
  }

  @Get('/psychologist/:psychologistId/client/:clientId')
  @IsMyTherapySessions()
  getAllForPsychologistAndClient(
    @Request() request: EnhancedRequest,
    @Param('clientId') clientId: string,
  ): Promise<Array<TherapySessionDocument>> {
    if (request.psychologistContext) {
      return this.therapySessionService.getAllForPsychologistAndClient(
        request.psychologistContext.id,
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

  @Post(currentUserAlias)
  @Roles(Role.Psychologist)
  @IsMyTherapySessions()
  @UsePipes(new JoiValidationPipe(joiCreateTherapySessionSchema))
  createForMe(
    @Request() request: EnhancedRequest,
    @Body() createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    if (request.psychologistContext) {
      return this.therapySessionService.createFor(
        request.psychologistContext.id,
        createData,
      );
    }
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
  remove(@Param('sessionId') sessionId: string): Promise<boolean> {
    return this.therapySessionService.remove(sessionId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TherapyRequestsService } from './therapy-requests.service';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { joiCreateTherapyRequestSchema } from './schemas/joi.create-therapy-request.schema';
import { CreateTherapyRequestDto } from './dto/create-therapy-request.dto';
import { joiUpdateTherapyRequestSchema } from './schemas/joi.update-therapy-request.schema';
import { UpdateTherapyRequestDto } from './dto/update-therapy-request.dto';
import { TherapyRequestsGuard } from './therapy-requests.guard';
import { IsMyData } from './decorators/is-my-data.decorator';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';

@Controller('therapy-requests')
@Roles(Role.Admin, Role.Editor, Role.Psychologist)
@UseGuards(TherapyRequestsGuard)
export class TherapyRequestsController {
  constructor(private therapyRequestService: TherapyRequestsService) {}

  @Get()
  getAll(@Query() params?: { [key: string]: any }) {
    let accepted: boolean | undefined;
    try {
      accepted = !!JSON.parse(params.accepted);
    } catch {
      accepted = undefined;
    }
    return this.therapyRequestService.getAll({ accepted });
  }

  @Get(':therapyRequestId')
  getOne(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.getById(therapyRequestId);
  }

  @Get('/psychologist/:psychologistId')
  @IsMyData()
  getAllForPsychologist(
    @Request() req,
    @Param('psychologistId') psychologistId: string,
    @Query() params?: { [key: string]: any },
  ) {
    let accepted: boolean | undefined;
    try {
      accepted = !!JSON.parse(params.accepted);
    } catch {
      accepted = undefined;
    }

    if (req.psychologist) {
      const psychologistId = (
        req.psychologist as PsychologistDocument
      )._id.toString();
      return this.therapyRequestService.getAllForPsychologist(psychologistId, {
        accepted,
      });
    } else if (psychologistId) {
      return this.therapyRequestService.getAllForPsychologist(psychologistId, {
        accepted,
      });
    }
  }

  @Post()
  create(
    @Body(new JoiValidationPipe(joiCreateTherapyRequestSchema))
    createData: CreateTherapyRequestDto,
  ) {
    return this.therapyRequestService.create(createData);
  }

  @Post(':therapyRequestId/accept')
  acceptRequest(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.acceptRequest(therapyRequestId);
  }

  @Post(':therapyRequestId/reject')
  rejectRequest(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.rejectRequest(therapyRequestId);
  }

  @Put(':therapyRequestId')
  update(
    @Param('therapyRequestId') therapyRequestId: string,
    @Body(new JoiValidationPipe(joiUpdateTherapyRequestSchema))
    updateData: UpdateTherapyRequestDto,
  ) {
    return this.therapyRequestService.update(therapyRequestId, updateData);
  }

  @Delete(':therapyRequestId')
  remove(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.remove(therapyRequestId);
  }
}

import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
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
import { TherapyRequestQueryParams } from 'src/common/types/therapy-request-params.types';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { IsMyData } from './decorators/is-my-data.decorator';
import { CreateTherapyRequestDto } from './dto/create-therapy-request.dto';
import { UpdateTherapyRequestDto } from './dto/update-therapy-request.dto';
import { joiCreateTherapyRequestSchema } from './schemas/joi.create-therapy-request.schema';
import { joiUpdateTherapyRequestSchema } from './schemas/joi.update-therapy-request.schema';
import { TherapyRequestsGuard } from './therapy-requests.guard';
import { TherapyRequestsService } from './therapy-requests.service';

@Controller('therapy-requests')
@Roles(Role.Admin, Role.Editor, Role.Psychologist)
@UseGuards(TherapyRequestsGuard)
export class TherapyRequestsController {
  constructor(private therapyRequestService: TherapyRequestsService) {}

  @Get()
  getAll(@Query() params?: TherapyRequestQueryParams) {
    let accepted: boolean | undefined;
    try {
      accepted = params?.accepted
        ? !!JSON.parse(params.accepted.toString())
        : undefined;
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
    @Request() request: EnhancedRequest,
    @Param('psychologistId') psychologistId: string,
    @Query() params?: TherapyRequestQueryParams,
  ) {
    let accepted: boolean | undefined;
    try {
      accepted = params?.accepted
        ? !!JSON.parse(params.accepted.toString())
        : undefined;
    } catch {
      accepted = undefined;
    }

    if (request.psychologistContext) {
      const psychologistId = request.psychologistContext.id;
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
  @Roles(Role.User)
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

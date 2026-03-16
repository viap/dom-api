import { currentUserAlias } from '@/common/const/current-user-alias';
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
@Roles(Role.Admin, Role.Editor)
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
  @IsMyData()
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

    if (psychologistId && psychologistId !== currentUserAlias) {
      return this.therapyRequestService.getAllForPsychologist(psychologistId, {
        accepted,
      });
    } else if (request.psychologistContext) {
      return this.therapyRequestService.getAllForPsychologist(
        request.psychologistContext.id,
        {
          accepted,
        },
      );
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
  @IsMyData()
  acceptRequest(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.acceptRequest(therapyRequestId);
  }

  @Post(':therapyRequestId/reject')
  @IsMyData()
  rejectRequest(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.rejectRequest(therapyRequestId);
  }

  @Put(':therapyRequestId')
  @IsMyData()
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

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { currentUserAlias } from '@/common/const/current-user-alias';
import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import { TherapyRequestQueryParams } from '@/common/types/therapy-request-params.types';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
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
  @Roles(Role.Admin, Role.Editor)
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
  @Roles(Role.Admin, Role.Editor)
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
    @Request() request: EnhancedRequest,
    @Param('therapyRequestId') therapyRequestId: string,
    @Body(new JoiValidationPipe(joiUpdateTherapyRequestSchema))
    updateData: UpdateTherapyRequestDto,
  ) {
    // A psychologist may only transfer their own request to a colleague.
    const roles = request.userContext?.roles || [];
    const canEditAnything =
      roles.includes(Role.Admin) || roles.includes(Role.Editor);
    const fields = Object.keys(updateData);
    if (
      !canEditAnything &&
      (fields.length !== 1 || fields[0] !== 'psychologist')
    ) {
      throw new ForbiddenException();
    }

    return this.therapyRequestService.update(therapyRequestId, updateData);
  }

  @Delete(':therapyRequestId')
  @Roles(Role.Admin, Role.Editor)
  remove(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.remove(therapyRequestId);
  }
}

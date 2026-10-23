import {
  BadRequestException,
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
  acceptRequest(
    @Request() request: EnhancedRequest,
    @Param('therapyRequestId') therapyRequestId: string,
  ) {
    // A psychologist's claim must still name them, so a concurrent transfer
    // to a colleague wins; admins and editors accept on anyone's behalf.
    return this.therapyRequestService.acceptRequest(
      therapyRequestId,
      this.ownPsychologistId(request),
    );
  }

  @Post(':therapyRequestId/reject')
  rejectRequest(
    @Request() request: EnhancedRequest,
    @Param('therapyRequestId') therapyRequestId: string,
  ) {
    return this.therapyRequestService.rejectRequest(
      therapyRequestId,
      this.ownPsychologistId(request),
    );
  }

  @Put(':therapyRequestId')
  update(
    @Request() request: EnhancedRequest,
    @Param('therapyRequestId') therapyRequestId: string,
    @Body(new JoiValidationPipe(joiUpdateTherapyRequestSchema))
    updateData: UpdateTherapyRequestDto,
  ) {
    // A psychologist may only transfer their own request to a colleague.
    if (!this.canManageAll(request)) {
      if (Object.keys(updateData).some((field) => field !== 'psychologist')) {
        throw new ForbiddenException();
      }
      if (!updateData.psychologist) {
        throw new BadRequestException('psychologist is required');
      }
    }

    return this.therapyRequestService.update(
      therapyRequestId,
      updateData,
      this.ownPsychologistId(request),
    );
  }

  @Delete(':therapyRequestId')
  @Roles(Role.Admin, Role.Editor)
  remove(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.remove(therapyRequestId);
  }

  // A psychologist's writes are conditional on still owning the request, so
  // they cannot race a concurrent transfer; admins and editors act on anyone's.
  private ownPsychologistId(request: EnhancedRequest): string | undefined {
    return this.canManageAll(request)
      ? undefined
      : request.psychologistContext?.id;
  }

  private canManageAll(request: EnhancedRequest): boolean {
    const roles = request.userContext?.roles || [];
    return roles.includes(Role.Admin) || roles.includes(Role.Editor);
  }
}

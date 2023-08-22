import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { TherapyRequestsService } from './therapy-requests.service';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { joiCreateTherapyRequestSchema } from './schemas/joi.create-therapy-request.schema';
import { CreateTherapyRequestDto } from './dto/create-therapy-request.dto';
import { joiUpdateTherapyRequestSchema } from './schemas/joi.update-therapy-request.schema';
import { UpdateTherapyRequestDto } from './dto/update-therapy-request.dto';

@Controller('therapy-requests')
export class TherapyRequestsController {
  constructor(private therapyRequestService: TherapyRequestsService) {}

  @Get()
  getAll() {
    return this.therapyRequestService.getAll();
  }

  @Get(':therapyRequestId')
  getOne(@Param('therapyRequestId') therapyRequestId: string) {
    return this.therapyRequestService.getById(therapyRequestId);
  }

  @Post()
  create(
    @Body(new JoiValidationPipe(joiCreateTherapyRequestSchema))
    createData: CreateTherapyRequestDto,
  ) {
    return this.therapyRequestService.create(createData);
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

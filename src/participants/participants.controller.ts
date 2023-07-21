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
import {
  CreateParticipantDto,
  createParticipantSchema,
} from './dto/create-participant.dto';
import {
  UpdateParticipantDto,
  updateParticipantSchema,
} from './dto/update-participant.dto';
import { ParticipantsService } from './participants.service';
import { Participant } from './schema/participant.schema';

@Controller('participants')
@Roles(Role.Admin, Role.Editor)
export class ParticipantsController {
  constructor(private participantsService: ParticipantsService) {}

  @Get()
  async getAll(): Promise<Array<Participant>> {
    return this.participantsService.getAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<Participant> {
    return this.participantsService.getById(id);
  }

  @Post()
  @UsePipes(new JoiValidationPipe(createParticipantSchema))
  async create(@Body() createData: CreateParticipantDto) {
    return this.participantsService.create(createData);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateParticipantSchema))
    updateData: UpdateParticipantDto,
  ) {
    return this.participantsService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async remove(@Param('id') id: string): Promise<Participant | null> {
    return this.participantsService.remove(id);
  }
}

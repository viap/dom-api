import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UsePipes,
} from '@nestjs/common';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { Roles } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';
import { CreateNewClientDto } from './dto/create-new-client.dto';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import { PsychologistsService } from './psychologists.service';
import { Client } from './schemas/clients.schema';
import { joiCreateNewClientSchema } from './schemas/joi.create-new-client.schema';
import { joiCreatePsychologistSchema } from './schemas/joi.create-psychologist.schema';
import { joiUpdatePsychologistSchema } from './schemas/joi.update-psychologist.schema';
import { PsychologistDocument } from './schemas/psychologist.schema';

@Controller('psychologists')
export class PsychologistsController {
  constructor(private readonly psychologistService: PsychologistsService) {}

  @Get()
  @Roles(Role.Admin, Role.Editor)
  async getAll(): Promise<Array<PsychologistDocument>> {
    return this.psychologistService.getAll();
  }

  @Get('me')
  @Roles(Role.Psychologist)
  getMe(@Request() req): Promise<PsychologistDocument> {
    const user = req.user as UserDocument;
    if (user) {
      return this.psychologistService.getByUserId(user._id.toString());
    }
  }

  @Get('me/clients')
  @Roles(Role.Psychologist)
  async getClients(@Request() req): Promise<Array<Client>> {
    const psychologist = await this.getMe(req);
    if (psychologist) {
      return this.psychologistService.getClients(psychologist._id.toString());
    }
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Editor)
  async getOne(@Param('id') id: string): Promise<PsychologistDocument> {
    return this.psychologistService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new JoiValidationPipe(joiCreatePsychologistSchema))
  @Roles(Role.Admin, Role.Editor)
  async create(
    @Body() createData: CreatePsychologistDto,
  ): Promise<PsychologistDocument> {
    return this.psychologistService.create(createData);
  }

  @Post('me/add-new-client')
  @Roles(Role.Psychologist)
  async addMyNewClient(
    @Request() req,
    @Body(new JoiValidationPipe(joiCreateNewClientSchema))
    client: CreateNewClientDto,
  ): Promise<boolean> {
    const psychologist = await this.getMe(req);
    if (psychologist) {
      return this.psychologistService.addNewClient(
        psychologist._id.toString(),
        client,
      );
    }
  }

  @Post(':id/add-client/:clientId')
  @Roles(Role.Admin, Role.Editor)
  async addClient(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
  ): Promise<boolean> {
    return this.psychologistService.addClient(id, clientId);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Editor)
  async update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(joiUpdatePsychologistSchema))
    updateData: UpdatePsychologistDto,
  ): Promise<PsychologistDocument> {
    return this.psychologistService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async remove(@Param('id') id: string): Promise<PsychologistDocument> {
    return this.psychologistService.remove(id);
  }
}

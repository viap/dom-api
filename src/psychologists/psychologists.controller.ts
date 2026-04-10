import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
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
import { currentUserAlias } from '@/common/const/current-user-alias';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { CreateNewClientDto } from './dto/create-new-client.dto';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { EditMyClientDto } from './dto/edit-my-client.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import { PsychologistsService } from './psychologists.service';
import { Client } from './schemas/clients.schema';
import { joiCreateNewClientSchema } from './schemas/joi.create-new-client.schema';
import { joiCreatePsychologistSchema } from './schemas/joi.create-psychologist.schema';
import { joiEditMyClientSchema } from './schemas/joi.edit-my-client.schema';
import { joiUpdatePsychologistSchema } from './schemas/joi.update-psychologist.schema';
import { PsychologistDocument } from './schemas/psychologist.schema';

// TODO: create a psychologist guard
@Controller('psychologists')
export class PsychologistsController {
  constructor(private readonly psychologistService: PsychologistsService) {}

  @Get()
  @Roles(Role.User)
  async getAll(): Promise<Array<PsychologistDocument>> {
    return this.psychologistService.getAll();
  }

  @Get(currentUserAlias)
  @Roles(Role.Psychologist)
  getMe(@Request() request: EnhancedRequest): Promise<PsychologistDocument> {
    if (request.userContext) {
      return this.psychologistService.getByUserId(request.userContext.userId);
    }
  }

  @Get(currentUserAlias + '/clients')
  @Roles(Role.Psychologist)
  async getClients(
    @Request() request: EnhancedRequest,
  ): Promise<Array<Client>> {
    const psychologist = await this.getMe(request);
    if (psychologist) {
      return this.psychologistService.getClients(psychologist._id.toString());
    }
  }

  @Get(':id')
  @Roles(Role.User)
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

  @Post(currentUserAlias + '/add-new-client')
  @Roles(Role.Psychologist)
  async addMyNewClient(
    @Request() request: EnhancedRequest,
    @Body(new JoiValidationPipe(joiCreateNewClientSchema))
    clientData: CreateNewClientDto,
  ): Promise<boolean> {
    const psychologist = await this.getMe(request);
    if (psychologist) {
      return this.psychologistService.addNewClient(
        psychologist._id.toString(),
        clientData,
      );
    }
  }

  @Put(currentUserAlias + '/edit-client/:userId')
  @Roles(Role.Admin, Role.Editor, Role.Psychologist)
  async editMyClient(
    @Request() request: EnhancedRequest,
    @Param('userId') userId: string,
    @Body(new JoiValidationPipe(joiEditMyClientSchema))
    clientData: EditMyClientDto,
  ): Promise<boolean> {
    const psychologist = await this.getMe(request);
    if (psychologist) {
      return this.psychologistService.editPsychologistClient(
        psychologist._id.toString(),
        userId,
        clientData,
      );
    }
  }

  @Post(':id/add-client/:clientId')
  @Roles(Role.Admin, Role.Editor, Role.Psychologist)
  async addClient(
    @Param('id') id: string,
    @Param('clientId') clientId: string,
  ): Promise<boolean> {
    return this.psychologistService.addClientFromUser(id, clientId);
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

  @Delete(currentUserAlias + '/delete-client/:userId')
  @Roles(Role.Admin, Role.Psychologist)
  async deleteClient(
    @Request() request: EnhancedRequest,
    @Param('userId') userId: string,
  ): Promise<boolean> {
    const psychologist = await this.getMe(request);
    if (psychologist) {
      return this.psychologistService.deleteClient(psychologist._id, userId);
    }
    return false;
  }

  @Delete(':userId')
  @Roles(Role.Admin)
  async delete(@Param('userId') userId: string): Promise<boolean> {
    return this.psychologistService.delete(userId);
  }
}

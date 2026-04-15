import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { Public } from '@/auth/decorators/public.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaService } from './media.service';
import { createMediaSchema } from './schemas/joi.create-media.schema';
import { mediaAdminQuerySchema } from './schemas/joi.media-admin-query.schema';
import { mediaQuerySchema } from './schemas/joi.media-query.schema';
import { updateMediaSchema } from './schemas/joi.update-media.schema';
import { uploadMediaSchema } from './schemas/joi.upload-media.schema';
import { MediaAdminQueryParams } from './types/admin-query-params.interface';
import { MediaQueryParams } from './types/query-params.interface';
import { UploadedMediaFile } from './types/uploaded-media-file.interface';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @Public()
  findAll(
    @Query(new JoiValidationPipe(mediaQuerySchema)) query: MediaQueryParams,
  ) {
    return this.mediaService.findAll(query);
  }

  @Get('admin')
  @Roles(Role.Admin, Role.Editor)
  findAllAdmin(
    @Query(new JoiValidationPipe(mediaAdminQuerySchema))
    query: MediaAdminQueryParams,
  ) {
    return this.mediaService.findAllAdmin(query);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createMediaSchema))
    createMediaDto: CreateMediaDto,
  ) {
    return this.mediaService.create(createMediaDto);
  }

  @Post('upload')
  @Roles(Role.Admin, Role.Editor)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  upload(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body(new JoiValidationPipe(uploadMediaSchema))
    uploadMediaDto: UploadMediaDto,
  ) {
    if (!file) {
      throw new BadRequestException('Validation failed: file is required');
    }

    return this.mediaService.upload(file, uploadMediaDto);
  }

  @Get(':id([0-9a-fA-F]{24})/content')
  @Public()
  async getContent(@Param('id') id: string, @Res() res: Response) {
    const content = await this.mediaService.getContent(id);
    return new Promise<void>((resolve, reject) => {
      res.type(content.mimeType);
      res.sendFile(content.path, (error) => {
        if (!error) {
          resolve();
          return;
        }

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new NotFoundException('Media content not found'));
          return;
        }

        reject(new InternalServerErrorException('Failed to stream media content'));
      });
    });
  }

  @Get(':id([0-9a-fA-F]{24})/thumbnail')
  @Public()
  async getThumbnail(@Param('id') id: string, @Res() res: Response) {
    const thumbnail = await this.mediaService.getThumbnail(id);
    return new Promise<void>((resolve, reject) => {
      res.type(thumbnail.mimeType);
      res.sendFile(thumbnail.path, (error) => {
        if (!error) {
          resolve();
          return;
        }

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new NotFoundException('Media thumbnail not found'));
          return;
        }

        reject(
          new InternalServerErrorException('Failed to stream media thumbnail'),
        );
      });
    });
  }

  @Get(':id([0-9a-fA-F]{24})')
  @Public()
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateMediaSchema))
    updateMediaDto: UpdateMediaDto,
  ) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}

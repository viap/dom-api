import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { imageSize } from 'image-size';
import { copyFile, mkdir, unlink, writeFile } from 'fs/promises';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { basename, extname, join, resolve, sep } from 'path';
import sharp from 'sharp';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import { resolveExistingIds } from '@/common/utils/resolve-ids';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaKind } from './enums/media-kind.enum';
import { Media, MediaDocument } from './schemas/media.schema';
import { MediaAdminQueryParams } from './types/admin-query-params.interface';
import { MediaQueryParams } from './types/query-params.interface';
import { UploadedMediaFile } from './types/uploaded-media-file.interface';

type SupportedImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';

const IMAGE_FORMAT_TO_MIME: Record<SupportedImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const IMAGE_FORMAT_TO_EXTENSION: Record<SupportedImageFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  gif: '.gif',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadsRoot = join(process.cwd(), 'uploads', 'media');
  private readonly uploadsThumbnailsRoot = join(
    process.cwd(),
    'uploads',
    'thumbnails',
  );
  private readonly allowedMimeTypes = new Set(
    Object.values(IMAGE_FORMAT_TO_MIME),
  );

  constructor(
    @InjectModel(Media.name) private mediaModel: Model<MediaDocument>,
  ) {}

  async create(createMediaDto: CreateMediaDto): Promise<MediaDocument> {
    if (!this.isExternalUrl(createMediaDto.url)) {
      throw new BadRequestException(
        'External media URL must use http or https',
      );
    }

    const media = new this.mediaModel({
      ...createMediaDto,
      title: this.normalizeOptionalText(createMediaDto.title),
      alt: this.normalizeOptionalText(createMediaDto.alt),
      folder: this.normalizeFolder(createMediaDto.folder),
    });

    return media.save();
  }

  async findAll(queryParams: MediaQueryParams = {}): Promise<MediaDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = { isPublished: true };

    if (typeof safeParams.kind === 'string') {
      query.kind = safeParams.kind;
    }

    if (typeof safeParams.search === 'string' && safeParams.search.trim()) {
      query.title = {
        $regex: this.escapeRegExp(safeParams.search.trim()),
        $options: 'i',
      };
    }

    const folder = this.parseFolderQuery(safeParams.folder);
    if (folder) {
      query.folder = folder;
    }

    return this.mediaModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findAllAdmin(
    queryParams: MediaAdminQueryParams = {},
  ): Promise<MediaDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {};

    if (typeof safeParams.kind === 'string') {
      query.kind = safeParams.kind;
    }

    if (typeof safeParams.search === 'string' && safeParams.search.trim()) {
      query.title = {
        $regex: this.escapeRegExp(safeParams.search.trim()),
        $options: 'i',
      };
    }

    const folder = this.parseFolderQuery(safeParams.folder);
    if (folder) {
      query.folder = folder;
    }

    const createdAt: Record<string, Date> = {};
    if (typeof safeParams.createdFrom === 'string') {
      createdAt.$gte = this.parseIsoDate(safeParams.createdFrom, 'createdFrom');
    }
    if (typeof safeParams.createdTo === 'string') {
      createdAt.$lte = this.parseIsoDate(safeParams.createdTo, 'createdTo');
    }
    if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
      throw new BadRequestException('createdFrom must be before createdTo');
    }
    if (Object.keys(createdAt).length > 0) {
      query.createdAt = createdAt;
    }

    return this.mediaModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<MediaDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    const media = await this.mediaModel
      .findOne({ _id: validId, isPublished: true })
      .lean()
      .exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media as MediaDocument;
  }

  async getContent(id: string): Promise<{ path: string; mimeType: string }> {
    const media = await this.findPublishedUploadedMediaOrThrow(
      id,
      'Media content not found',
    );

    const path = this.resolveUploadedFilePath(media.storageKey);

    return {
      path,
      mimeType: media.mimeType || 'application/octet-stream',
    };
  }

  async getThumbnail(id: string): Promise<{ path: string; mimeType: string }> {
    const media = await this.findPublishedUploadedMediaOrThrow(
      id,
      'Media thumbnail not found',
    );

    const path = this.resolveThumbnailFilePath(media.storageKey);

    return {
      path,
      mimeType: this.resolveMimeTypeFromPath(path),
    };
  }

  async upload(
    file: UploadedMediaFile,
    uploadMediaDto: UploadMediaDto = {},
  ): Promise<MediaDocument> {
    const format = this.detectImageFormat(file);
    const mimeType = IMAGE_FORMAT_TO_MIME[format];
    const extension = IMAGE_FORMAT_TO_EXTENSION[format];
    let dimensions: ReturnType<typeof imageSize>;
    try {
      dimensions = imageSize(file.buffer as unknown as Uint8Array);
    } catch {
      throw new BadRequestException('Unsupported media type');
    }

    const now = new Date();
    const year = now.getUTCFullYear().toString();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const storageKey = `${year}/${month}/${filename}`;
    const targetDir = join(this.uploadsRoot, year, month);
    const targetPath = join(targetDir, filename);
    const thumbnailTargetDir = join(this.uploadsThumbnailsRoot, year, month);
    const thumbnailTargetPath = join(thumbnailTargetDir, filename);
    const media = new this.mediaModel({
      kind: MediaKind.Image,
      storageKey,
      title: this.normalizeTitle(uploadMediaDto.title, file.originalname),
      mimeType,
      sizeBytes: file.size,
      alt: this.normalizeOptionalText(uploadMediaDto.alt),
      folder: this.normalizeFolder(uploadMediaDto.folder),
      width: dimensions.width,
      height: dimensions.height,
      isPublished: true,
    });

    media.url = this.buildContentUrl(media._id.toString());

    try {
      await mkdir(targetDir, { recursive: true });
      await mkdir(thumbnailTargetDir, { recursive: true });
      await writeFile(targetPath, file.buffer as unknown as Uint8Array);
      if (format === 'gif') {
        await copyFile(targetPath, thumbnailTargetPath);
      } else {
        await this.buildThumbnailFromFile(targetPath, thumbnailTargetPath, format);
      }
      return await media.save();
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      await unlink(thumbnailTargetPath).catch(() => undefined);
      throw error;
    }
  }

  async update(
    id: string,
    updateMediaDto: UpdateMediaDto,
  ): Promise<MediaDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    const setData: Record<string, unknown> = {};
    const unsetData: Record<string, ''> = {};

    if (typeof updateMediaDto.title === 'string') {
      setData.title = this.normalizeOptionalText(updateMediaDto.title);
    }
    if (typeof updateMediaDto.alt === 'string') {
      setData.alt = this.normalizeOptionalText(updateMediaDto.alt);
    }
    if (typeof updateMediaDto.isPublished === 'boolean') {
      setData.isPublished = updateMediaDto.isPublished;
    }
    if (typeof updateMediaDto.folder === 'string') {
      const normalizedFolder = this.normalizeFolder(updateMediaDto.folder);
      if (normalizedFolder) {
        setData.folder = normalizedFolder;
      } else {
        unsetData.folder = '';
      }
    }

    const updateData: Record<string, unknown> = {};
    if (Object.keys(setData).length > 0) {
      updateData.$set = setData;
    }
    if (Object.keys(unsetData).length > 0) {
      updateData.$unset = unsetData;
    }

    const media = await this.mediaModel
      .findByIdAndUpdate(validId, updateData, { new: true })
      .lean()
      .exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media as MediaDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    const media = await this.mediaModel.findByIdAndDelete(validId).lean().exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (this.isUploadedMedia(media)) {
      const path = this.resolveUploadedFilePath(media.storageKey);
      const thumbnailPath = this.resolveThumbnailFilePath(media.storageKey);
      const mediaId = media._id.toString();
      await this.removeFileBestEffort(path, mediaId);
      await this.removeFileBestEffort(thumbnailPath, mediaId);
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.mediaModel.countDocuments({ _id: validId });
    return count > 0;
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.mediaModel, ids);
  }

  async existsPublished(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.mediaModel.countDocuments({
      _id: validId,
      isPublished: true,
    });
    return count > 0;
  }

  async existingPublishedIds(ids: string[]): Promise<Set<string>> {
    const validIds = ids
      .map((id) => validateObjectId(id))
      .filter((id): id is string => Boolean(id));

    if (!validIds.length) {
      return new Set<string>();
    }

    const media = await this.mediaModel
      .find({ _id: { $in: validIds }, isPublished: true })
      .select({ _id: 1 })
      .lean()
      .exec();

    return new Set(media.map((item) => item._id.toString()));
  }

  async findAllAdminFolders(): Promise<string[]> {
    const folders = await this.mediaModel.distinct('folder');

    return folders
      .filter(
        (folder): folder is string =>
          typeof folder === 'string' && folder.trim().length > 0,
      )
      .sort((a, b) => a.localeCompare(b));
  }

  private detectImageFormat(file: UploadedMediaFile): SupportedImageFormat {
    const format = this.readImageFormatFromBuffer(file.buffer);
    if (!format) {
      throw new BadRequestException('Unsupported media type');
    }

    const detectedMimeType = IMAGE_FORMAT_TO_MIME[format];
    if (file.mimetype && file.mimetype !== detectedMimeType) {
      throw new BadRequestException('Uploaded file does not match MIME type');
    }

    const originalExtension = extname(file.originalname).toLowerCase();
    if (originalExtension) {
      const originalMimeType = EXTENSION_TO_MIME[originalExtension];
      if (originalMimeType && originalMimeType !== detectedMimeType) {
        throw new BadRequestException(
          'Uploaded file does not match file extension',
        );
      }
    }

    if (!this.allowedMimeTypes.has(detectedMimeType)) {
      throw new BadRequestException('Unsupported media type');
    }

    return format;
  }

  private normalizeTitle(
    input: string | undefined,
    originalname: string,
  ): string {
    const normalizedInput = this.normalizeOptionalText(input);
    if (normalizedInput) {
      return normalizedInput;
    }

    const sourceName = basename(originalname, extname(originalname))
      .replace(/[_-]+/g, ' ')
      .trim();

    return sourceName || 'Untitled media';
  }

  private normalizeOptionalText(value: string | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeFolder(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private parseFolderQuery(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private buildContentUrl(id: string): string {
    return `/media/${id}/content`;
  }

  private isExternalUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private isUploadedMedia(
    media: Pick<Media, 'storageKey' | 'url'>,
  ): media is Pick<Media, 'storageKey' | 'url'> & { storageKey: string } {
    return Boolean(media.storageKey) && !this.isExternalUrl(media.url);
  }

  private resolveUploadedFilePath(storageKey: string): string {
    const root = resolve(this.uploadsRoot);
    const path = resolve(root, storageKey);
    if (path !== root && !path.startsWith(`${root}${sep}`)) {
      throw new BadRequestException('Invalid media storage key');
    }

    return path;
  }

  private resolveThumbnailFilePath(storageKey: string): string {
    const root = resolve(this.uploadsThumbnailsRoot);
    const path = resolve(root, storageKey);
    if (path !== root && !path.startsWith(`${root}${sep}`)) {
      throw new BadRequestException('Invalid media storage key');
    }

    return path;
  }

  private parseIsoDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }

    return date;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private readImageFormatFromBuffer(
    buffer: Buffer,
  ): SupportedImageFormat | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      return 'jpeg';
    }

    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'png';
    }

    if (
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
    ) {
      return 'gif';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'webp';
    }

    return null;
  }

  private async buildThumbnailFromFile(
    sourcePath: string,
    outputPath: string,
    format: SupportedImageFormat,
  ): Promise<void> {
    await sharp(sourcePath)
      .resize({ width: 320, fit: 'inside', withoutEnlargement: true })
      .toFormat(format)
      .toFile(outputPath);
  }

  private async findPublishedUploadedMediaOrThrow(
    id: string,
    notFoundMessage: string,
  ): Promise<Pick<Media, 'storageKey' | 'mimeType'>> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    const media = await this.mediaModel
      .findOne({ _id: validId, isPublished: true })
      .lean()
      .exec();
    if (!media || !this.isUploadedMedia(media)) {
      throw new NotFoundException(notFoundMessage);
    }

    return media;
  }

  private resolveMimeTypeFromPath(path: string): string {
    const extension = extname(path).toLowerCase();
    return EXTENSION_TO_MIME[extension] || 'application/octet-stream';
  }

  private async removeFileBestEffort(path: string, mediaId: string) {
    try {
      await unlink(path);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        return;
      }
      this.logger.warn(
        `Failed to cleanup media file (mediaId=${mediaId}, path=${path}): ${err?.message || 'unknown error'}`,
      );
    }
  }
}

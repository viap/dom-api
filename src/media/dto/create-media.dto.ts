import { MediaKind } from '../enums/media-kind.enum';

export interface CreateMediaDto {
  kind: MediaKind;
  url: string;
  title?: string;
  mimeType?: string;
  sizeBytes?: number;
  alt?: string;
  folder?: string;
  width?: number;
  height?: number;
  isPublished?: boolean;
}

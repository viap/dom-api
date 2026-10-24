import mongoose from 'mongoose';
import {
  isEntityCollectionColumns,
  type EntityCollectionColumns,
} from '@/pages/types/entity-collection-columns';

export class EntityCollectionColumnsSchemaType extends mongoose.SchemaType {
  constructor(path: string) {
    super(path, {}, 'EntityCollectionColumns');
  }

  cast(value: unknown): EntityCollectionColumns {
    if (isEntityCollectionColumns(value)) {
      return value;
    }

    throw new mongoose.Error.CastError(
      'EntityCollectionColumns',
      value,
      this.path,
    );
  }
}

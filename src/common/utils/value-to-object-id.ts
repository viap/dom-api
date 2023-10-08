import mongoose from 'mongoose';

export function valueToObjectId(
  value: string | number,
): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

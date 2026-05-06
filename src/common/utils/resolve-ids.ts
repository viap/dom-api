import { Model } from 'mongoose';
import { validateObjectId } from './mongo-sanitizer';

export async function resolveExistingIds(
  model: Model<any>,
  ids: string[],
): Promise<Set<string>> {
  const validIds = ids
    .map((id) => validateObjectId(id))
    .filter((id): id is string => Boolean(id));

  if (!validIds.length) {
    return new Set<string>();
  }

  const docs = await model
    .find({ _id: { $in: validIds } })
    .select({ _id: 1 })
    .lean()
    .exec();

  return new Set(docs.map((doc: any) => doc._id.toString()));
}

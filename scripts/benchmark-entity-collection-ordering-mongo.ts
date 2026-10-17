/** Read-only measurement; never loads app configuration or provisions data/indexes. */
import mongoose from 'mongoose';
import { benchmarkCollection } from './entity-collection-benchmark';
import { RANDOM_SCAN_TIMEOUT_MS } from '../src/common/utils/ranked-query';
async function main() {
  const uri = process.env.ENTITY_ORDER_BENCH_MONGO_URI;
  const database = process.env.ENTITY_ORDER_BENCH_DATABASE;
  const collection = process.env.ENTITY_ORDER_BENCH_COLLECTION;
  if (
    !uri ||
    !database ||
    !collection ||
    process.env.ENTITY_ORDER_BENCH_ISOLATED_LOCAL !== 'yes'
  )
    throw new Error(
      'Explicit isolated local URI, database, collection and consent flag required',
    );
  const url = new URL(uri);
  if (
    url.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error('Only isolated loopback MongoDB is allowed; no tunnels');
  const filter = JSON.parse(
    process.env.ENTITY_ORDER_BENCH_FILTER ?? '{"isPublished":true}',
  );
  const connection = await mongoose
    .createConnection(uri, {
      dbName: database,
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 3000,
    })
    .asPromise();
  try {
    const model = connection.model(
      'OrderingBenchmark',
      new mongoose.Schema(
        {
          fullName: String,
          title: String,
          domainId: mongoose.Schema.Types.ObjectId,
          status: String,
        },
        { strict: false, collection, autoCreate: false, autoIndex: false },
      ),
    );
    const projection = { _id: 1, fullName: 1, title: 1 };
    const candidateCount = await model.countDocuments(filter).exec();
    const explainExecutionStats = await model
      .find(filter)
      .select(projection)
      .explain('executionStats');
    await benchmarkCollection(
      candidateCount,
      () =>
        model
          .find(filter)
          .select(projection)
          .lean()
          .maxTimeMS(RANDOM_SCAN_TIMEOUT_MS)
          .cursor(),
      async (limit) => {
        if (collection.startsWith('events')) {
          const now = new Date().toISOString();
          const upcoming = await model
            .find({ ...filter, endAt: { $gte: now } })
            .select(projection)
            .sort({ startAt: 1, title: 1, _id: 1 })
            .limit(limit)
            .lean()
            .exec();
          if (upcoming.length >= limit) return upcoming;
          const past = await model
            .find({ ...filter, endAt: { $lt: now } })
            .select(projection)
            .sort({ startAt: -1, title: 1, _id: 1 })
            .limit(limit - upcoming.length)
            .lean()
            .exec();
          return [...upcoming, ...past];
        }
        return model
          .find(filter)
          .select(projection)
          .sort(
            collection.startsWith('people')
              ? { fullName: 1, _id: 1 }
              : { title: 1, _id: 1 },
          )
          .limit(limit)
          .lean()
          .exec();
      },
      {
        kind: 'isolated-local-mongo',
        collection,
        queryFilter: filter,
        explainExecutionStats,
        note: 'Local data only; R1 remains OPEN.',
      },
      collection.startsWith('events')
        ? 'events'
        : collection.startsWith('partners')
        ? 'partners'
        : 'people',
    );
  } finally {
    await connection.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

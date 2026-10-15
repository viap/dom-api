/** Creates a NEW disposable local benchmark database, never an application database. */
import mongoose from 'mongoose';
import { personSchema } from '../src/people/schemas/person.schema';
import { partnerSchema } from '../src/partners/schemas/partner.schema';
import { domainEventSchema } from '../src/events/schemas/domain-event.schema';
async function main() {
  const uri = process.env.ENTITY_ORDER_BENCH_MONGO_URI;
  const database = process.env.ENTITY_ORDER_BENCH_DATABASE;
  if (
    !uri ||
    !database?.startsWith('entity_order_bench_') ||
    process.env.ENTITY_ORDER_BENCH_ISOLATED_LOCAL !== 'yes'
  )
    throw new Error(
      'Explicit disposable database prefix and local consent required',
    );
  const url = new URL(uri);
  if (
    url.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error('Only isolated loopback MongoDB is allowed; no tunnels');
  const connection = await mongoose
    .createConnection(uri, {
      dbName: database,
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 3000,
    })
    .asPromise();
  try {
    if ((await connection.db.listCollections().toArray()).length)
      throw new Error('Refusing to modify a non-empty database');
    for (const count of [1000, 10000, 50000]) {
      for (const [entity, schema] of [
        ['people', personSchema],
        ['partners', partnerSchema],
        ['events', domainEventSchema],
      ] as const) {
        const name = `${entity}_${count}`;
        const model = connection.model(name, schema.clone(), name);
        const rows = Array.from({ length: count }, (_, i) => ({
          _id: new mongoose.Types.ObjectId(i.toString(16).padStart(24, '0')),
          fullName: `Person ${i}`,
          title: `Title ${i}`,
          slug: `item-${i}`,
          isPublished: true,
          domainId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439221'),
          status: i % 2 ? 'completed' : 'planned',
          startAt: i % 2 ? '2020-01-01T00:00:00Z' : '2030-01-01T00:00:00Z',
          endAt: i % 2 ? '2020-01-01T01:00:00Z' : '2030-01-01T01:00:00Z',
        }));
        await model.collection.insertMany(rows);
        // Preserve production keys/options. Explicit fixture-only names avoid the
        // existing Event schema's repeated unnamed partial-index name collision.
        for (const [index, [keys, options]] of schema.indexes().entries()) {
          await model.collection.createIndex(
            keys as mongoose.mongo.IndexSpecification,
            { ...options, name: options.name ?? `fixture_index_${index}` },
          );
        }
        console.log(
          JSON.stringify({
            database,
            collection: name,
            count,
            indexes: schema.indexes().length,
          }),
        );
      }
    }
  } finally {
    await connection.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

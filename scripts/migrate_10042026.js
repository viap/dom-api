/**
 * One-time migration script.
 *
 * Run BEFORE deploying updated code:
 *   node scripts/migrate_10042026.js
 *
 * What it does:
 *   1. notifications — startsAt number (unix ms) -> Date
 *   2. notifications — finishAt number (unix ms) -> Date
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD;
const MONGO_DB = process.env.MONGO_DBNAME || 'domData';

const NUMBER_TYPES = ['double', 'int', 'long', 'decimal'];

async function run() {
  const clientOptions =
    MONGO_USER && MONGO_PASS
      ? {
          auth: { username: MONGO_USER, password: MONGO_PASS },
          authSource: 'admin',
        }
      : {};

  const client = new MongoClient(MONGO_URL, clientOptions);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGO_DB);

    console.log(
      '\n[1/2] Migrating notifications.startsAt: number (unix ms) -> Date',
    );
    const startsAtResult = await db.collection('notifications').updateMany(
      {
        $expr: {
          $in: [{ $type: '$startsAt' }, NUMBER_TYPES],
        },
      },
      [
        {
          $set: {
            startsAt: { $toDate: '$startsAt' },
          },
        },
      ],
    );
    console.log(
      `  matched: ${startsAtResult.matchedCount}, modified: ${startsAtResult.modifiedCount}`,
    );

    console.log(
      '\n[2/2] Migrating notifications.finishAt: number (unix ms) -> Date',
    );
    const finishAtResult = await db.collection('notifications').updateMany(
      {
        $expr: {
          $in: [{ $type: '$finishAt' }, NUMBER_TYPES],
        },
      },
      [
        {
          $set: {
            finishAt: { $toDate: '$finishAt' },
          },
        },
      ],
    );
    console.log(
      `  matched: ${finishAtResult.matchedCount}, modified: ${finishAtResult.modifiedCount}`,
    );

    console.log('\nMigration complete.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

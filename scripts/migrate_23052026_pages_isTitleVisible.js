/**
 * One-time migration script.
 *
 * Run BEFORE deploying pages isTitleVisible contract updates:
 *   node scripts/migrate_23052026_pages_isTitleVisible.js
 *
 * What it does:
 *   1. Finds pages missing isTitleVisible
 *   2. Backfills isTitleVisible=true
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD;
const MONGO_DB = process.env.MONGO_DBNAME || 'domData';

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

    const pages = client.db(MONGO_DB).collection('pages');
    const result = await pages.updateMany(
      { isTitleVisible: { $exists: false } },
      { $set: { isTitleVisible: true } },
    );

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    console.log('Migration complete.');
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

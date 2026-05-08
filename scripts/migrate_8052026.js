/**
 * One-time migration script.
 *
 * Run BEFORE deploying updated code:
 *   node scripts/migrate_8052026.js
 *
 * What it does:
 *   1. users — drops non-sparse unique index on `login`
 *   2. users — creates sparse unique index on `login`
 *
 * Why: Legacy users without a `login` field cause a unique constraint
 * violation when more than one such document exists. The sparse index
 * ignores documents where the field is absent, fixing the issue.
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

    const users = client.db(MONGO_DB).collection('users');

    console.log('\n[1/2] Dropping existing non-sparse unique index on users.login');
    const existingIndexes = await users.indexes();
    const loginIndex = existingIndexes.find(
      (idx) => idx.key && idx.key.login === 1,
    );

    if (loginIndex) {
      await users.dropIndex(loginIndex.name);
      console.log(`  Dropped index: ${loginIndex.name}`);
    } else {
      console.log('  No login index found, skipping drop');
    }

    console.log('\n[2/2] Creating sparse unique index on users.login');
    const newIndexName = await users.createIndex(
      { login: 1 },
      { unique: true, sparse: true },
    );
    console.log(`  Created index: ${newIndexName}`);

    console.log('\nMigration complete.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

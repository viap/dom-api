/**
 * One-time migration script.
 *
 * Run BEFORE deploying updated code:
 *   node scripts/migrate.js
 *
 * What it does:
 *   1. therapy_requests  — timestamp (number ms) → createdAt/updatedAt (Date)
 *   2. therapy_sessions  — timestamp (number ms) → createdAt/updatedAt (Date)
 *   3. notifications     — timesatamp (typo, number ms) → createdAt/updatedAt (Date)
 *   4. therapy_sessions  — comission → commission ($rename)
 *   5. therapy_sessions  — remove legacy `date` field
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD;
const MONGO_DB = process.env.MONGO_DBNAME || 'domData';

async function run() {
  const clientOptions = MONGO_USER && MONGO_PASS
    ? { auth: { username: MONGO_USER, password: MONGO_PASS }, authSource: 'admin' }
    : {};

  const client = new MongoClient(MONGO_URL, clientOptions);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGO_DB);

    // 1. therapy_requests: timestamp → createdAt/updatedAt
    console.log('\n[1/5] Migrating therapy_requests: timestamp → createdAt/updatedAt');
    const trResult = await db.collection('therapyrequests').updateMany(
      { timestamp: { $exists: true } },
      [
        {
          $set: {
            createdAt: { $toDate: '$timestamp' },
            updatedAt: { $toDate: '$timestamp' },
          },
        },
        { $unset: 'timestamp' },
      ],
    );
    console.log(`  matched: ${trResult.matchedCount}, modified: ${trResult.modifiedCount}`);

    // 2. therapy_sessions: timestamp → createdAt/updatedAt
    console.log('\n[2/5] Migrating therapy_sessions: timestamp → createdAt/updatedAt');
    const tsResult = await db.collection('therapysessions').updateMany(
      { timestamp: { $exists: true } },
      [
        {
          $set: {
            createdAt: { $toDate: '$timestamp' },
            updatedAt: { $toDate: '$timestamp' },
          },
        },
        { $unset: 'timestamp' },
      ],
    );
    console.log(`  matched: ${tsResult.matchedCount}, modified: ${tsResult.modifiedCount}`);

    // 3. notifications: timesatamp (typo) → createdAt/updatedAt
    console.log('\n[3/5] Migrating notifications: timesatamp → createdAt/updatedAt');
    const notifResult = await db.collection('notifications').updateMany(
      { timesatamp: { $exists: true } },
      [
        {
          $set: {
            createdAt: { $toDate: '$timesatamp' },
            updatedAt: { $toDate: '$timesatamp' },
          },
        },
        { $unset: 'timesatamp' },
      ],
    );
    console.log(`  matched: ${notifResult.matchedCount}, modified: ${notifResult.modifiedCount}`);

    // 4. therapy_sessions: comission → commission
    console.log('\n[4/5] Migrating therapy_sessions: comission → commission');
    const renameResult = await db.collection('therapysessions').updateMany(
      { comission: { $exists: true } },
      { $rename: { comission: 'commission' } },
    );
    console.log(`  matched: ${renameResult.matchedCount}, modified: ${renameResult.modifiedCount}`);

    // 5. therapy_sessions: remove legacy `date` field
    console.log('\n[5/5] Migrating therapy_sessions: unset legacy date field');
    const unsetDateResult = await db.collection('therapysessions').updateMany(
      { date: { $exists: true } },
      { $unset: { date: '' } },
    );
    console.log(`  matched: ${unsetDateResult.matchedCount}, modified: ${unsetDateResult.modifiedCount}`);

    console.log('\nMigration complete.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

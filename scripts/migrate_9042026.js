/**
 * One-time migration script.
 *
 * Run BEFORE deploying updated code:
 *   node scripts/migrate_9042026.js
 *
 * What it does:
 *   1. users     — set timeZone to '+04:00' (Georgian Time) for all documents missing the field
 *   2. bookings  — timeZone 'UTC' → '+04:00'
 *   3. schedules — timeZone 'UTC' → '+04:00'
 *   4. companies — settings.timeZone 'UTC' → '+04:00'
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
      ? { auth: { username: MONGO_USER, password: MONGO_PASS }, authSource: 'admin' }
      : {};

  const client = new MongoClient(MONGO_URL, clientOptions);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGO_DB);

    // 1. users: add default timeZone '+04:00' where missing
    console.log("\n[1/4] Migrating users: set timeZone = '+04:00' where missing");
    const usersResult = await db.collection('users').updateMany(
      { timeZone: { $exists: false } },
      { $set: { timeZone: '+04:00' } },
    );
    console.log(`  matched: ${usersResult.matchedCount}, modified: ${usersResult.modifiedCount}`);

    // 2. bookings
    console.log("\n[2/4] Migrating bookings: timeZone 'UTC' → '+04:00'");
    const bookingsResult = await db.collection('bookings').updateMany(
      { timeZone: 'UTC' },
      { $set: { timeZone: '+04:00' } },
    );
    console.log(`  matched: ${bookingsResult.matchedCount}, modified: ${bookingsResult.modifiedCount}`);

    // 3. schedules
    console.log("\n[3/4] Migrating schedules: timeZone 'UTC' → '+04:00'");
    const schedulesResult = await db.collection('schedules').updateMany(
      { timeZone: 'UTC' },
      { $set: { timeZone: '+04:00' } },
    );
    console.log(`  matched: ${schedulesResult.matchedCount}, modified: ${schedulesResult.modifiedCount}`);

    // 4. companies (nested in settings)
    console.log("\n[4/4] Migrating companies: settings.timeZone 'UTC' → '+04:00'");
    const companiesResult = await db.collection('companies').updateMany(
      { 'settings.timeZone': 'UTC' },
      { $set: { 'settings.timeZone': '+04:00' } },
    );
    console.log(`  matched: ${companiesResult.matchedCount}, modified: ${companiesResult.modifiedCount}`);

    console.log('\nMigration complete.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

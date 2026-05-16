/**
 * One-time migration script.
 *
 * Run BEFORE deploying updated code:
 *   node scripts/migrate_12052026_people_languages.js
 *
 * What it does:
 *   1. people.languages — backfill missing/empty values to ['ru']
 *   2. people.languages — map legacy aliases: eng -> en, ge -> ka
 *   3. people.languages — remove unknown values and dedupe
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD;
const MONGO_DB = process.env.MONGO_DBNAME || 'domData';

const VALID_LANGUAGES = new Set(['ru', 'en', 'ka']);
const ALIASES = {
  eng: 'en',
  ge: 'ka',
};

function normalizeLanguages(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();

  for (const item of source) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim().toLowerCase();
    if (!trimmed) {
      continue;
    }

    const mapped = ALIASES[trimmed] || trimmed;
    if (!VALID_LANGUAGES.has(mapped) || seen.has(mapped)) {
      continue;
    }

    seen.add(mapped);
    normalized.push(mapped);
  }

  return normalized.length ? normalized : ['ru'];
}

function isSameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((entry, index) => entry === b[index]);
}

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

    const people = client.db(MONGO_DB).collection('people');
    const total = await people.countDocuments({});

    console.log('\n[1/1] Normalizing people.languages');
    console.log(`  scanned documents: ${total}`);

    const cursor = people.find({}, { projection: { _id: 1, languages: 1 } });

    let matched = 0;
    let modified = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) {
        continue;
      }

      matched += 1;
      const nextLanguages = normalizeLanguages(doc.languages);

      if (isSameStringArray(doc.languages, nextLanguages)) {
        continue;
      }

      await people.updateOne(
        { _id: doc._id },
        { $set: { languages: nextLanguages } },
      );
      modified += 1;
    }

    console.log(`  matched: ${matched}, modified: ${modified}`);
    console.log('\nMigration complete.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

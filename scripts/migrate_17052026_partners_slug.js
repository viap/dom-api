/**
 * One-time migration script.
 *
 * Run BEFORE deploying updated partners slug requirements:
 *   node scripts/migrate_17052026_partners_slug.js
 *
 * What it does:
 *   1. Backfills missing/empty/invalid partners.slug values
 *   2. Preserves existing valid unique slugs
 *   3. Resolves collisions with deterministic numeric suffixes
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD;
const MONGO_DB = process.env.MONGO_DBNAME || 'domData';

const CYRILLIC_TO_LATIN_MAP = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterateCyrillic(input) {
  return Array.from(input)
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] || char)
    .join('');
}

function isValidSlug(input) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(input || '').trim());
}

function generateSlug(input) {
  const normalized = transliterateCyrillic(
    String(input || '')
      .trim()
      .toLowerCase(),
  )
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return isValidSlug(normalized) ? normalized : '';
}

function fallbackSlugForId(id) {
  const raw = String(id || '');
  return `partner-${raw.slice(-6).toLowerCase()}`;
}

function uniqueSlug(baseSlug, usedSlugs) {
  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.add(baseSlug);
    return baseSlug;
  }

  let suffix = 2;
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  const resolved = `${baseSlug}-${suffix}`;
  usedSlugs.add(resolved);
  return resolved;
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

    const partners = client.db(MONGO_DB).collection('partners');
    const docs = await partners
      .find({}, { projection: { _id: 1, title: 1, slug: 1 } })
      .toArray();

    console.log(`Scanned partner documents: ${docs.length}`);

    const usedSlugs = new Set();
    const orderedDocs = [...docs].sort((a, b) =>
      String(a._id).localeCompare(String(b._id)),
    );

    let modified = 0;
    let generated = 0;
    let normalized = 0;
    let collisionsResolved = 0;

    for (const doc of orderedDocs) {
      const currentSlug = typeof doc.slug === 'string' ? doc.slug.trim() : '';
      const isCurrentValid = currentSlug && isValidSlug(currentSlug);
      if (isCurrentValid && !usedSlugs.has(currentSlug)) {
        usedSlugs.add(currentSlug);
        continue;
      }

      let baseSlug = isCurrentValid ? currentSlug : generateSlug(doc.title);
      if (!baseSlug) {
        baseSlug = fallbackSlugForId(doc._id);
      }

      if (!isCurrentValid) {
        generated += 1;
      } else {
        normalized += 1;
      }

      const nextSlug = uniqueSlug(baseSlug, usedSlugs);

      if (nextSlug !== baseSlug) {
        collisionsResolved += 1;
      }

      await partners.updateOne({ _id: doc._id }, { $set: { slug: nextSlug } });
      modified += 1;
    }

    console.log(`Modified: ${modified}`);
    console.log(`Generated/backfilled: ${generated}`);
    console.log(`Normalized from invalid values: ${normalized}`);
    console.log(`Collision suffixes applied: ${collisionsResolved}`);
    console.log('Migration complete.');
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

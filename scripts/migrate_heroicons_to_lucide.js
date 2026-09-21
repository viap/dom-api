/**
 * Dry-run-first Heroicons-to-Lucide migration for CMS Hero blocks.
 *
 * Inventory legacy names without writes:
 *   node scripts/migrate_heroicons_to_lucide.js
 *
 * Supply reviewed mappings for values reported as unmapped:
 *   node scripts/migrate_heroicons_to_lucide.js --mapping ./heroicon-map.json
 *
 * Apply only when the dry run reports no unmapped legacy names:
 *   node scripts/migrate_heroicons_to_lucide.js --mapping ./heroicon-map.json --write --confirm-production-migration
 */

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');
const {
  buildHeroIconMigrationProposal,
  mergeMappings,
  parseOptions,
} = require('./migrate_heroicons_to_lucide.helpers');

const SAMPLE_LIMIT = 20;
const COLLECTION_NAMES = ['pages', 'events'];

function readMongoConfig(env = process.env) {
  if (!env.MONGO_URL || !env.MONGO_DBNAME) {
    throw new Error(
      'MONGO_URL and MONGO_DBNAME are required to run Heroicon migration.',
    );
  }

  return {
    url: env.MONGO_URL,
    dbName: env.MONGO_DBNAME,
    user: env.MONGO_INITDB_ROOT_USERNAME,
    password: env.MONGO_INITDB_ROOT_PASSWORD,
  };
}

function readMappingFile(mappingPath) {
  if (!mappingPath) {
    return {};
  }

  return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
}

function addSample(collection, sample) {
  if (collection.length < SAMPLE_LIMIT) {
    collection.push(sample);
  }
}

function createCollectionStats() {
  return {
    scanned: 0,
    heroBlocks: 0,
    legacyIconOccurrences: 0,
    migrationCandidates: 0,
    updated: 0,
    concurrentlySkipped: 0,
    samples: [],
  };
}

function createStats(options) {
  return {
    mode: options.write ? 'write' : 'dry-run',
    options,
    collections: Object.fromEntries(
      COLLECTION_NAMES.map((name) => [name, createCollectionStats()]),
    ),
    legacyIconNames: [],
    unmappedLegacyIconNames: [],
    migrationCandidates: 0,
    updated: 0,
    concurrentlySkipped: 0,
    manifest: { path: undefined, entries: 0 },
  };
}

function cursorWithLimit(cursor, limit) {
  return limit ? cursor.limit(limit) : cursor;
}

async function collectCollectionProposals({
  collection,
  collectionName,
  mapping,
  options,
  stats,
}) {
  const collectionStats = stats.collections[collectionName];
  const cursor = cursorWithLimit(collection.find({}), options.limit);
  const proposals = [];
  const legacyIconNames = new Set(stats.legacyIconNames);
  const unmappedLegacyIconNames = new Set(stats.unmappedLegacyIconNames);

  while (await cursor.hasNext()) {
    const document = await cursor.next();
    if (!document) {
      continue;
    }

    collectionStats.scanned += 1;
    const proposal = buildHeroIconMigrationProposal(document, mapping);
    const heroBlocks = Array.isArray(document.blocks)
      ? document.blocks.filter((block) => block?.type === 'hero').length
      : 0;
    collectionStats.heroBlocks += heroBlocks;
    collectionStats.legacyIconOccurrences += proposal.legacyIconOccurrences;
    proposal.legacyIconNames.forEach((name) => legacyIconNames.add(name));
    proposal.unmappedLegacyIconNames.forEach((name) =>
      unmappedLegacyIconNames.add(name),
    );

    if (!proposal.changed) {
      continue;
    }

    collectionStats.migrationCandidates += 1;
    stats.migrationCandidates += 1;
    addSample(collectionStats.samples, {
      id: document._id?.toString(),
      changes: proposal.changedIcons,
    });
    proposals.push({ document, proposal });
  }

  stats.legacyIconNames = Array.from(legacyIconNames).sort();
  stats.unmappedLegacyIconNames = Array.from(unmappedLegacyIconNames).sort();
  return proposals;
}

async function applyCollectionProposals({
  collection,
  collectionName,
  proposals,
  stats,
}) {
  const collectionStats = stats.collections[collectionName];
  const manifestEntries = [];

  for (const { document, proposal } of proposals) {
    const result = await collection.updateOne(
      { _id: document._id, blocks: proposal.originalBlocks },
      { $set: { blocks: proposal.migratedBlocks } },
    );

    if (result.modifiedCount === 1) {
      collectionStats.updated += 1;
      stats.updated += 1;
      manifestEntries.push({
        collection: collectionName,
        id: document._id?.toString(),
        changes: proposal.changedIcons,
      });
    } else {
      collectionStats.concurrentlySkipped += 1;
      stats.concurrentlySkipped += 1;
    }
  }

  return manifestEntries;
}

function defaultManifestPath(now = new Date()) {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return path.join(
    process.cwd(),
    `heroicon_migration_manifest_${timestamp}.json`,
  );
}

function writeManifest(manifestPath, entries) {
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    entries,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function printSummary(stats) {
  console.log('\nHeroicons-to-Lucide migration');
  console.log(`Mode: ${stats.mode}`);
  console.log(
    `Legacy icon names: ${stats.legacyIconNames.join(', ') || 'none'}`,
  );
  console.log(
    `Unmapped legacy icon names: ${
      stats.unmappedLegacyIconNames.join(', ') || 'none'
    }`,
  );
  console.log(
    `Candidates: ${stats.migrationCandidates}, updated: ${stats.updated}, concurrently skipped: ${stats.concurrentlySkipped}`,
  );

  for (const collectionName of COLLECTION_NAMES) {
    const collection = stats.collections[collectionName];
    console.log(
      `${collectionName}: scanned=${collection.scanned}, heroBlocks=${collection.heroBlocks}, legacyIconOccurrences=${collection.legacyIconOccurrences}, candidates=${collection.migrationCandidates}, updated=${collection.updated}, concurrentlySkipped=${collection.concurrentlySkipped}`,
    );
  }

  if (stats.manifest.path) {
    console.log(
      `Manifest: ${stats.manifest.path} (${stats.manifest.entries} entries)`,
    );
  }

  console.log('\nStructured JSON:');
  console.log(JSON.stringify(stats, null, 2));
}

function assertWriteIsSafe(options, stats) {
  if (options.write && stats.unmappedLegacyIconNames.length > 0) {
    throw new Error(
      'Refusing to write while unmapped legacy Heroicon values remain. Add reviewed mappings and rerun the dry run.',
    );
  }
}

async function run(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const mapping = mergeMappings(readMappingFile(options.mappingPath));
  const mongoConfig = readMongoConfig();
  const client = new MongoClient(
    mongoConfig.url,
    mongoConfig.user && mongoConfig.password
      ? {
          auth: { username: mongoConfig.user, password: mongoConfig.password },
          authSource: 'admin',
        }
      : {},
  );
  const stats = createStats(options);

  try {
    await client.connect();
    const database = client.db(mongoConfig.dbName);
    const proposalsByCollection = {};

    for (const collectionName of COLLECTION_NAMES) {
      proposalsByCollection[collectionName] = await collectCollectionProposals({
        collection: database.collection(collectionName),
        collectionName,
        mapping,
        options,
        stats,
      });
    }

    if (options.write && stats.unmappedLegacyIconNames.length > 0) {
      printSummary(stats);
      assertWriteIsSafe(options, stats);
    }

    if (options.write) {
      const entries = [];
      for (const collectionName of COLLECTION_NAMES) {
        const collectionEntries = await applyCollectionProposals({
          collection: database.collection(collectionName),
          collectionName,
          proposals: proposalsByCollection[collectionName],
          stats,
        });
        entries.push(...collectionEntries);
      }

      const manifestPath = options.manifestPath || defaultManifestPath();
      writeManifest(manifestPath, entries);
      stats.manifest = { path: manifestPath, entries: entries.length };
    }

    printSummary(stats);
    return stats;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Heroicon migration failed:', error.message || error);
    process.exit(1);
  });
}

module.exports = {
  applyCollectionProposals,
  assertWriteIsSafe,
  collectCollectionProposals,
  createStats,
  defaultManifestPath,
  readMongoConfig,
  run,
};

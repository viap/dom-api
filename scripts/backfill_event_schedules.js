/**
 * Dry-run-first backfill for per-day event schedules.
 *
 * Dry run:
 *   node scripts/backfill_event_schedules.js
 *
 * Write absent schedules only:
 *   node scripts/backfill_event_schedules.js --write --confirm-production-backfill
 *
 * Roll back schedules created by a manifest:
 *   node scripts/backfill_event_schedules.js --rollback-manifest ./event_schedule_backfill_manifest.json
 *   node scripts/backfill_event_schedules.js --rollback-manifest ./event_schedule_backfill_manifest.json --write --confirm-production-backfill
 */

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient, ObjectId } = require('mongodb');
const {
  AMBIGUOUS_REASONS,
  buildEventScheduleMigrationProposal,
  createAmbiguousSample,
  createManifest,
  createMigrationSample,
  createRollbackDecision,
  idToString,
  normalizeManifest,
  parseOptions,
} = require('./backfill_event_schedules.helpers');

const SAMPLE_LIMIT = 20;

function readMongoConfig(env = process.env) {
  if (!env.MONGO_URL || !env.MONGO_DBNAME) {
    throw new Error(
      'MONGO_URL and MONGO_DBNAME are required to run event schedule backfill.',
    );
  }

  return {
    url: env.MONGO_URL,
    dbName: env.MONGO_DBNAME,
    user: env.MONGO_INITDB_ROOT_USERNAME,
    password: env.MONGO_INITDB_ROOT_PASSWORD,
  };
}

function createEmptyAmbiguousCounts() {
  return Object.values(AMBIGUOUS_REASONS).reduce((acc, reason) => {
    acc[reason] = 0;
    return acc;
  }, {});
}

function createStats(options) {
  return {
    mode: options.rollbackManifestPath
      ? options.write
        ? 'rollback-write'
        : 'rollback-dry-run'
      : options.write
      ? 'write'
      : 'dry-run',
    options,
    events: {
      scanned: 0,
      absentScheduleCandidates: 0,
      alreadyScheduled: 0,
      malformedExistingSchedules: 0,
      proposedMigrations: 0,
      updated: 0,
      concurrentlySkipped: 0,
      failed: 0,
      ambiguous: {
        total: 0,
        byReason: createEmptyAmbiguousCounts(),
        samples: [],
      },
      samples: [],
      proposedMutations: [],
      failures: [],
    },
    rollback: {
      manifestEntries: 0,
      wouldRevert: 0,
      reverted: 0,
      skipped: 0,
      failed: 0,
      samples: [],
      skippedSamples: [],
      failures: [],
    },
    manifest: {
      path: undefined,
      entries: 0,
    },
  };
}

function cursorWithLimit(cursor, limit) {
  return limit ? cursor.limit(limit) : cursor;
}

function addSample(collection, sample, limit = SAMPLE_LIMIT) {
  if (collection.length < limit) {
    collection.push(sample);
  }
}

function countAmbiguous(stats, event, proposal) {
  stats.events.ambiguous.total += 1;
  stats.events.ambiguous.byReason[proposal.reason] =
    (stats.events.ambiguous.byReason[proposal.reason] || 0) + 1;

  if (proposal.reason === AMBIGUOUS_REASONS.MalformedExistingSchedule) {
    stats.events.malformedExistingSchedules += 1;
  }

  addSample(
    stats.events.ambiguous.samples,
    createAmbiguousSample(event, proposal),
  );
}

function toMongoId(value) {
  const stringValue = idToString(value);
  if (
    ObjectId.isValid(stringValue) &&
    new ObjectId(stringValue).toString() === stringValue
  ) {
    return new ObjectId(stringValue);
  }

  return value;
}

function defaultManifestPath(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return path.join(
    process.cwd(),
    `event_schedule_backfill_manifest_${stamp}.json`,
  );
}

function writeManifestFile(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function readManifestFile(manifestPath) {
  return normalizeManifest(
    JSON.parse(fs.readFileSync(manifestPath, { encoding: 'utf8' })),
  );
}

async function processEvents({ collection, options, stats }) {
  const cursor = cursorWithLimit(collection.find({}), options.limit);
  const manifestEntries = [];

  while (await cursor.hasNext()) {
    const event = await cursor.next();
    if (!event) {
      continue;
    }

    stats.events.scanned += 1;

    let proposal;
    try {
      proposal = buildEventScheduleMigrationProposal(event, options);
    } catch (error) {
      stats.events.failed += 1;
      addSample(stats.events.failures, {
        _id: idToString(event._id),
        error: error.message || String(error),
      });
      continue;
    }

    if (proposal.status === 'alreadyScheduled') {
      stats.events.alreadyScheduled += 1;
      continue;
    }

    if (proposal.status === 'ambiguous') {
      if (!Object.prototype.hasOwnProperty.call(event, 'schedule')) {
        stats.events.absentScheduleCandidates += 1;
      }
      countAmbiguous(stats, event, proposal);
      continue;
    }

    stats.events.absentScheduleCandidates += 1;
    stats.events.proposedMigrations += 1;
    addSample(stats.events.samples, createMigrationSample(event, proposal));
    addSample(stats.events.proposedMutations, proposal.mutation);

    if (!options.write) {
      manifestEntries.push(proposal.manifestEntry);
      continue;
    }

    try {
      const result = await collection.updateOne(
        { _id: event._id, schedule: { $exists: false } },
        { $set: { schedule: proposal.schedule } },
      );

      if (result.modifiedCount === 1) {
        stats.events.updated += 1;
        manifestEntries.push(proposal.manifestEntry);
      } else {
        stats.events.concurrentlySkipped += 1;
      }
    } catch (error) {
      stats.events.failed += 1;
      addSample(stats.events.failures, {
        _id: idToString(event._id),
        error: error.message || String(error),
      });
    }
  }

  if (options.write || options.manifestPath) {
    const manifestPath = options.manifestPath || defaultManifestPath();
    const manifest = createManifest({
      entries: manifestEntries,
      options,
      mode: stats.mode,
    });
    writeManifestFile(manifestPath, manifest);
    stats.manifest.path = manifestPath;
    stats.manifest.entries = manifest.entries.length;
  } else {
    stats.manifest.entries = manifestEntries.length;
  }
}

async function processRollback({ collection, manifest, options, stats }) {
  const entries = manifest.entries || [];
  stats.rollback.manifestEntries = entries.length;

  for (const entry of entries) {
    const eventId = toMongoId(entry.eventId);

    try {
      const event = await collection.findOne({ _id: eventId });
      const decision = createRollbackDecision(event, entry);

      if (decision.status === 'skipped') {
        stats.rollback.skipped += 1;
        addSample(stats.rollback.skippedSamples, {
          eventId: entry.eventId,
          reason: decision.reason,
          currentFingerprint: decision.currentFingerprint,
          expectedFingerprint: decision.expectedFingerprint,
        });
        continue;
      }

      stats.rollback.wouldRevert += 1;
      addSample(stats.rollback.samples, {
        eventId: entry.eventId,
        scheduleFingerprint: entry.scheduleFingerprint,
      });

      if (!options.write) {
        continue;
      }

      const result = await collection.updateOne(
        { _id: eventId, schedule: event.schedule },
        { $unset: { schedule: '' } },
      );

      if (result.modifiedCount === 1) {
        stats.rollback.reverted += 1;
      } else {
        stats.rollback.skipped += 1;
        addSample(stats.rollback.skippedSamples, {
          eventId: entry.eventId,
          reason: 'concurrentScheduleChange',
        });
      }
    } catch (error) {
      stats.rollback.failed += 1;
      addSample(stats.rollback.failures, {
        eventId: entry.eventId,
        error: error.message || String(error),
      });
    }
  }
}

function printReadableSummary(stats) {
  console.log('\nEvent schedule backfill');
  console.log(`Mode: ${stats.mode}`);

  if (stats.mode.startsWith('rollback')) {
    console.log(
      `Rollback: manifestEntries=${stats.rollback.manifestEntries}, wouldRevert=${stats.rollback.wouldRevert}, reverted=${stats.rollback.reverted}, skipped=${stats.rollback.skipped}, failed=${stats.rollback.failed}`,
    );
  } else {
    console.log(
      `Events: scanned=${stats.events.scanned}, absentScheduleCandidates=${stats.events.absentScheduleCandidates}, alreadyScheduled=${stats.events.alreadyScheduled}, proposedMigrations=${stats.events.proposedMigrations}, updated=${stats.events.updated}, concurrentlySkipped=${stats.events.concurrentlySkipped}, failed=${stats.events.failed}`,
    );
    console.log(
      `Ambiguous: total=${stats.events.ambiguous.total}, malformedExistingSchedules=${stats.events.malformedExistingSchedules}`,
    );
    console.log('\nAmbiguous by reason:');
    console.log(JSON.stringify(stats.events.ambiguous.byReason, null, 2));
  }

  if (stats.manifest.path) {
    console.log(
      `\nManifest: path=${stats.manifest.path}, entries=${stats.manifest.entries}`,
    );
  } else {
    console.log(`\nManifest entries: ${stats.manifest.entries}`);
  }

  if (stats.events.samples.length) {
    console.log('\nSample proposed migrations:');
    console.log(JSON.stringify(stats.events.samples, null, 2));
  }

  if (stats.events.ambiguous.samples.length) {
    console.log('\nSample ambiguous records:');
    console.log(JSON.stringify(stats.events.ambiguous.samples, null, 2));
  }

  if (stats.rollback.samples.length || stats.rollback.skippedSamples.length) {
    console.log('\nSample rollback decisions:');
    console.log(
      JSON.stringify(
        {
          revert: stats.rollback.samples,
          skipped: stats.rollback.skippedSamples,
        },
        null,
        2,
      ),
    );
  }

  if (stats.events.failures.length || stats.rollback.failures.length) {
    console.log('\nSample failures:');
    console.log(
      JSON.stringify(
        {
          events: stats.events.failures,
          rollback: stats.rollback.failures,
        },
        null,
        2,
      ),
    );
  }
}

async function run(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const mongoConfig = readMongoConfig();
  const clientOptions =
    mongoConfig.user && mongoConfig.password
      ? {
          auth: { username: mongoConfig.user, password: mongoConfig.password },
          authSource: 'admin',
        }
      : {};

  const client = new MongoClient(mongoConfig.url, clientOptions);
  const stats = createStats(options);

  try {
    await client.connect();
    const db = client.db(mongoConfig.dbName);
    const collection = db.collection('events');

    if (options.rollbackManifestPath) {
      const manifest = readManifestFile(options.rollbackManifestPath);
      await processRollback({ collection, manifest, options, stats });
    } else {
      await processEvents({ collection, options, stats });
    }

    printReadableSummary(stats);
    console.log('\nStructured JSON:');
    console.log(JSON.stringify(stats, null, 2));
    return stats;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Backfill failed:', error.message || error);
    process.exit(1);
  });
}

module.exports = {
  createStats,
  defaultManifestPath,
  processEvents,
  processRollback,
  readManifestFile,
  readMongoConfig,
  run,
  toMongoId,
};

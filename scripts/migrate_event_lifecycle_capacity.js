/**
 * Dry-run-first Event lifecycle/capacity migration.
 *
 * Dry run: node scripts/migrate_event_lifecycle_capacity.js
 * Write:   node scripts/migrate_event_lifecycle_capacity.js --write --confirm-production-migration --manifest ./manifest.json
 * Rollback dry run/write: add --rollback-manifest ./manifest.json [--write --confirm-production-migration]
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });
const { MongoClient, ObjectId } = require('mongodb');
const {
  buildProposal,
  migrationUpdate,
  rollbackPredicate,
  rollbackUpdate,
  sourcePredicate,
  fingerprint,
} = require('./migrate_event_lifecycle_capacity.helpers');

function persistManifest(filePath, manifest, exclusive = false) {
  const contents = `${JSON.stringify(manifest, null, 2)}\n`;
  if (exclusive) {
    const descriptor = fs.openSync(filePath, 'wx');
    try {
      fs.writeFileSync(descriptor, contents);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    return;
  }

  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx');
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    const directoryDescriptor = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function validateManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error('Invalid rollback manifest');
  }
  const ids = new Set();
  return manifest.entries.map((entry) => {
    if (!ObjectId.isValid(entry?._id) || ids.has(entry._id)) {
      throw new Error('Invalid or duplicate rollback manifest Event id');
    }
    ids.add(entry._id);
    if (
      entry.sourceFingerprint !== fingerprint(entry.original) ||
      entry.producedFingerprint !== fingerprint(entry.produced)
    ) {
      throw new Error(`Rollback manifest fingerprint mismatch: ${entry._id}`);
    }
    const sourceEvent = {
      status: entry.original.status,
      ...(Object.prototype.hasOwnProperty.call(entry.original, 'capacity')
        ? { capacity: entry.original.capacity }
        : {}),
      registration: Object.prototype.hasOwnProperty.call(
        entry.original,
        'maxParticipants',
      )
        ? { maxParticipants: entry.original.maxParticipants }
        : {},
      ...(entry.sourceRevision === undefined
        ? {}
        : { __v: entry.sourceRevision }),
    };
    const proposal = buildProposal(sourceEvent);
    if (
      proposal.status !== 'ready' ||
      proposal.mutationChecksum !== entry.mutationChecksum ||
      proposal.producedRevision !== entry.producedRevision
    ) {
      throw new Error(`Rollback manifest checksum mismatch: ${entry._id}`);
    }
    return { ...entry, _id: new ObjectId(entry._id) };
  });
}

function options(argv) {
  const result = { write: false, confirm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--write') result.write = true;
    else if (value === '--confirm-production-migration') result.confirm = true;
    else if (value === '--manifest') result.manifest = argv[++index];
    else if (value === '--rollback-manifest') result.rollback = argv[++index];
    else throw new Error(`Unknown option: ${value}`);
  }
  if (result.write && !result.confirm) {
    throw new Error('Write requires --confirm-production-migration');
  }
  if (result.write && !result.manifest && !result.rollback) {
    throw new Error('Write requires --manifest or --rollback-manifest');
  }
  return result;
}

async function runMigration(collection, config, applicationCollection) {
  const report = {
    scanned: 0,
    ready: 0,
    noop: 0,
    unresolved: [],
    conflicts: 0,
    rows: [],
  };
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    entries: [],
  };
  const ready = [];
  for await (const event of collection.find({})) {
    report.scanned += 1;
    const proposal = buildProposal(event);
    const registeredCount = applicationCollection
      ? await applicationCollection.countDocuments({
          formType: 'event_registration',
          'source.entityType': 'event',
          'source.entityId': event._id,
        })
      : undefined;
    report.rows.push({
      _id: String(event._id),
      classification: proposal.status,
      ...(proposal.reason ? { reason: proposal.reason } : {}),
      ...(registeredCount !== undefined ? { registeredCount } : {}),
      sourceRevision:
        proposal.sourceRevision === undefined
          ? { missing: true }
          : proposal.sourceRevision,
      ...(proposal.sourceFingerprint
        ? { sourceFingerprint: proposal.sourceFingerprint }
        : {}),
      ...(proposal.mutation ? { proposedMutation: proposal.mutation } : {}),
      ...(proposal.producedRevision !== undefined
        ? { producedRevision: proposal.producedRevision }
        : {}),
      ...(proposal.producedFingerprint
        ? { producedFingerprint: proposal.producedFingerprint }
        : {}),
    });
    if (proposal.status === 'unresolved') {
      report.unresolved.push({
        _id: String(event._id),
        reason: proposal.reason,
      });
      continue;
    }
    if (proposal.status === 'noop') {
      report.noop += 1;
      continue;
    }
    report.ready += 1;
    ready.push({ event, proposal });
  }

  if (!config.write) return report;
  if (report.unresolved.length) {
    report.writeBlocked = true;
    return report;
  }

  persistManifest(config.manifest, manifest, true);

  for (const { event, proposal } of ready) {
    const entry = {
      _id: String(event._id),
      state: 'pending',
      original: proposal.original,
      sourceRevision: proposal.sourceRevision,
      sourceFingerprint: proposal.sourceFingerprint,
      produced: proposal.produced,
      producedRevision: proposal.producedRevision,
      producedFingerprint: proposal.producedFingerprint,
      mutationChecksum: proposal.mutationChecksum,
    };
    manifest.entries.push(entry);
    // The durable pending entry is sufficient for conditional rollback if the
    // process exits after Mongo commits but before the success publication.
    persistManifest(config.manifest, manifest);
    const result = await collection.updateOne(
      sourcePredicate(event, proposal),
      migrationUpdate(proposal),
    );
    if (result.modifiedCount !== 1) {
      report.conflicts += 1;
      manifest.entries.pop();
      persistManifest(config.manifest, manifest);
      continue;
    }
    entry.state = 'applied';
    persistManifest(config.manifest, manifest);
  }
  return report;
}

async function runRollback(collection, config) {
  const manifest = JSON.parse(fs.readFileSync(config.rollback, 'utf8'));
  const entries = validateManifest(manifest);
  const report = {
    entries: entries.length,
    ready: 0,
    reverted: 0,
    conflicts: 0,
  };
  for (const normalized of entries) {
    if (!config.write) {
      const matches = await collection.countDocuments(
        rollbackPredicate(normalized),
        { limit: 1 },
      );
      if (matches === 1) report.ready += 1;
      else report.conflicts += 1;
      continue;
    }
    const result = await collection.updateOne(
      rollbackPredicate(normalized),
      rollbackUpdate(normalized),
    );
    if (result.modifiedCount === 1) report.reverted += 1;
    else report.conflicts += 1;
  }
  return report;
}

async function main() {
  const config = options(process.argv.slice(2));
  if (!process.env.MONGO_URL || !process.env.MONGO_DBNAME) {
    throw new Error('MONGO_URL and MONGO_DBNAME are required');
  }
  const client = new MongoClient(process.env.MONGO_URL, {
    auth:
      process.env.MONGO_INITDB_ROOT_USERNAME &&
      process.env.MONGO_INITDB_ROOT_PASSWORD
        ? {
            username: process.env.MONGO_INITDB_ROOT_USERNAME,
            password: process.env.MONGO_INITDB_ROOT_PASSWORD,
          }
        : undefined,
  });
  try {
    await client.connect();
    const collection = client.db(process.env.MONGO_DBNAME).collection('events');
    const applications = client
      .db(process.env.MONGO_DBNAME)
      .collection('applications');
    const report = config.rollback
      ? await runRollback(collection, config)
      : await runMigration(collection, config, applications);
    console.log(JSON.stringify(report, null, 2));
    if (report.unresolved?.length || report.conflicts) process.exitCode = 2;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { options, runMigration, runRollback };

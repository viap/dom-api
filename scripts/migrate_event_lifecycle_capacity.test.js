const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  options,
  runMigration,
  runRollback,
} = require('./migrate_event_lifecycle_capacity');
const { buildProposal } = require('./migrate_event_lifecycle_capacity.helpers');

function collectionFor(events, results = []) {
  const calls = [];
  return {
    calls,
    find() {
      return (async function* iterate() {
        for (const event of events) yield event;
      })();
    },
    async updateOne(predicate, update) {
      calls.push({ predicate, update });
      return results.shift() ?? { modifiedCount: 1 };
    },
  };
}

test('write preflight blocks every mutation when any row is unresolved', async () => {
  const collection = collectionFor([
    { _id: 'ready', __v: 2, status: 'planned', registration: {} },
    { _id: 'blocked', __v: 4, status: 'mystery', registration: {} },
  ]);
  const report = await runMigration(collection, {
    write: true,
    manifest: path.join(os.tmpdir(), 'must-not-be-written.json'),
  });

  assert.equal(report.writeBlocked, true);
  assert.equal(collection.calls.length, 0);
  assert.equal(report.unresolved.length, 1);
});

test('write records only CAS successes and never retries conflicts', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dom-event-migration-'),
  );
  const manifestPath = path.join(temporaryDirectory, 'manifest.json');
  try {
    const collection = collectionFor(
      [
        { _id: 'first', __v: 2, status: 'planned', registration: {} },
        { _id: 'second', status: 'ongoing', registration: {} },
      ],
      [{ modifiedCount: 1 }, { modifiedCount: 0 }],
    );
    const report = await runMigration(collection, {
      write: true,
      manifest: manifestPath,
    });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(report.conflicts, 1);
    assert.equal(collection.calls.length, 2);
    assert.equal(collection.calls[0].predicate.__v, 2);
    assert.deepEqual(collection.calls[1].predicate.__v, { $exists: false });
    assert.equal(manifest.entries.length, 1);
    assert.equal(manifest.entries[0]._id, 'first');
    assert.equal(manifest.entries[0].state, 'applied');
    assert.equal(manifest.entries[0].producedRevision, 3);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('write journals rollback intent durably before mutating Mongo', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dom-event-migration-journal-'),
  );
  const manifestPath = path.join(temporaryDirectory, 'manifest.json');
  const event = {
    _id: '507f1f77bcf86cd799439011',
    __v: 2,
    status: 'planned',
    registration: {},
  };
  const collection = {
    find() {
      return (async function* iterate() {
        yield event;
      })();
    },
    async updateOne() {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(manifest.entries.length, 1);
      assert.equal(manifest.entries[0]._id, event._id);
      assert.equal(manifest.entries[0].state, 'pending');
      return { modifiedCount: 1 };
    },
  };
  try {
    await runMigration(collection, { write: true, manifest: manifestPath });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.entries[0].state, 'applied');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('write mode requires an explicit production confirmation and manifest', () => {
  assert.throws(() => options(['--write']), /confirm-production-migration/);
  assert.throws(
    () => options(['--write', '--confirm-production-migration']),
    /manifest/,
  );
});

test('write reserves the manifest before the first mutation', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dom-event-migration-reserve-'),
  );
  const manifestPath = path.join(temporaryDirectory, 'manifest.json');
  fs.writeFileSync(manifestPath, '{}');
  const collection = collectionFor([
    { _id: 'ready', __v: 2, status: 'planned', registration: {} },
  ]);
  try {
    await assert.rejects(
      runMigration(collection, { write: true, manifest: manifestPath }),
      /EEXIST/,
    );
    assert.equal(collection.calls.length, 0);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('rollback dry run validates manifest and evaluates every CAS predicate', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dom-event-rollback-'),
  );
  const manifestPath = path.join(temporaryDirectory, 'manifest.json');
  const source = {
    status: 'planned',
    __v: 2,
    registration: { maxParticipants: 10 },
  };
  const proposal = buildProposal(source);
  const id = '507f1f77bcf86cd799439011';
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      version: 1,
      entries: [
        {
          _id: id,
          original: proposal.original,
          sourceRevision: proposal.sourceRevision,
          sourceFingerprint: proposal.sourceFingerprint,
          produced: proposal.produced,
          producedRevision: proposal.producedRevision,
          producedFingerprint: proposal.producedFingerprint,
          mutationChecksum: proposal.mutationChecksum,
        },
      ],
    }),
  );
  const predicates = [];
  const collection = {
    async countDocuments(predicate) {
      predicates.push(predicate);
      return 0;
    },
    async updateOne() {
      throw new Error('dry run must not write');
    },
  };
  try {
    const report = await runRollback(collection, {
      write: false,
      rollback: manifestPath,
    });
    assert.equal(report.ready, 0);
    assert.equal(report.conflicts, 1);
    assert.equal(predicates.length, 1);
    assert.equal(String(predicates[0]._id), id);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

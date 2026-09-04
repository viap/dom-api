const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  AMBIGUOUS_REASONS,
  buildEventScheduleMigrationProposal,
  computeScheduleFingerprint,
  createRollbackDecision,
  normalizeExistingSchedule,
  normalizeManifest,
  parseOptions,
} = require('./backfill_event_schedules.helpers');
const {
  createStats,
  processEvents,
  processRollback,
  readMongoConfig,
} = require('./backfill_event_schedules');

function createCursor(items) {
  const queue = [...items];
  return {
    limit() {
      return this;
    },
    async hasNext() {
      return queue.length > 0;
    },
    async next() {
      return queue.shift();
    },
  };
}

function legacyEvent(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    title: 'Legacy event',
    slug: 'legacy-event',
    startAt: '2026-04-20T10:00:00.000Z',
    endAt: '2026-04-20T12:00:00.000Z',
    ...overrides,
  };
}

function createTempManifestPath() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'event-schedule-backfill-test-'),
  );
  return path.join(directory, 'manifest.json');
}

test('parseOptions keeps dry-run default and requires write confirmation', () => {
  assert.deepEqual(parseOptions([]), {
    write: false,
    confirmProductionBackfill: false,
    limit: undefined,
    maxDays: 366,
    manifestPath: undefined,
    rollbackManifestPath: undefined,
  });

  assert.throws(() => parseOptions(['--write']), /Refusing to write/);
  assert.deepEqual(
    parseOptions([
      '--write',
      '--confirm-production-backfill',
      '--limit=10',
      '--max-days',
      '30',
      '--manifest',
      './manifest.json',
    ]),
    {
      write: true,
      confirmProductionBackfill: true,
      limit: 10,
      maxDays: 30,
      manifestPath: './manifest.json',
      rollbackManifestPath: undefined,
    },
  );
  assert.throws(
    () =>
      parseOptions(['--manifest', 'a.json', '--rollback-manifest', 'b.json']),
    /Use only one/,
  );
});

test('buildEventScheduleMigrationProposal converts a one-day legacy event', () => {
  const proposal = buildEventScheduleMigrationProposal(legacyEvent());

  assert.equal(proposal.status, 'migrate');
  assert.deepEqual(proposal.schedule, {
    timezone: 'Asia/Tbilisi',
    days: [
      {
        date: '2026-04-20',
        startTime: '14:00',
        endTime: '16:00',
      },
    ],
  });
  assert.equal(proposal.manifestEntry.originalStartAt, legacyEvent().startAt);
  assert.equal(proposal.manifestEntry.originalEndAt, legacyEvent().endAt);
  assert.equal(
    proposal.manifestEntry.scheduleFingerprint,
    computeScheduleFingerprint(proposal.schedule),
  );
});

test('buildEventScheduleMigrationProposal reports multi-day legacy ranges for manual review', () => {
  const proposal = buildEventScheduleMigrationProposal(
    legacyEvent({
      startAt: '2026-04-20T06:00:00.000Z',
      endAt: '2026-04-22T09:00:00.000Z',
    }),
  );

  assert.equal(proposal.status, 'ambiguous');
  assert.equal(
    proposal.reason,
    AMBIGUOUS_REASONS.MultiDayLegacyRangeRequiresReview,
  );
  assert.equal(proposal.mutation, undefined);
  assert.equal(proposal.manifestEntry, undefined);
});

test('buildEventScheduleMigrationProposal reports ambiguous legacy records', () => {
  assert.equal(
    buildEventScheduleMigrationProposal(legacyEvent({ startAt: undefined }))
      .reason,
    AMBIGUOUS_REASONS.MissingLegacyTiming,
  );
  assert.equal(
    buildEventScheduleMigrationProposal(
      legacyEvent({ startAt: '2026-04-20T10:00:00Z' }),
    ).reason,
    AMBIGUOUS_REASONS.NonStrictUtcIso,
  );
  assert.equal(
    buildEventScheduleMigrationProposal(
      legacyEvent({ startAt: '2026-02-30T10:00:00.000Z' }),
    ).reason,
    AMBIGUOUS_REASONS.MalformedLegacyTiming,
  );
  assert.equal(
    buildEventScheduleMigrationProposal(
      legacyEvent({ endAt: '2026-04-20T10:00:00.000Z' }),
    ).reason,
    AMBIGUOUS_REASONS.EndNotAfterStart,
  );
  assert.equal(
    buildEventScheduleMigrationProposal(
      legacyEvent({
        startAt: '2026-04-20T19:00:00.000Z',
        endAt: '2026-04-21T18:00:00.000Z',
      }),
    ).reason,
    AMBIGUOUS_REASONS.MultiDayLegacyRangeRequiresReview,
  );
  assert.equal(
    buildEventScheduleMigrationProposal(
      legacyEvent({
        startAt: '2026-04-20T06:00:00.000Z',
        endAt: '2026-04-22T09:00:00.000Z',
      }),
      { maxDays: 2 },
    ).reason,
    AMBIGUOUS_REASONS.UnexpectedlyLargeRange,
  );
});

test('normalizeExistingSchedule validates and normalizes existing schedules', () => {
  assert.deepEqual(
    normalizeExistingSchedule({
      timezone: 'Asia/Tbilisi',
      days: [
        {
          date: '2026-04-20',
          startTime: '10:00',
          endTime: '12:00',
          description: '  Opening  ',
        },
      ],
    }),
    {
      timezone: 'Asia/Tbilisi',
      days: [
        {
          date: '2026-04-20',
          startTime: '10:00',
          endTime: '12:00',
          description: 'Opening',
        },
      ],
    },
  );

  assert.throws(
    () =>
      normalizeExistingSchedule({
        timezone: 'UTC',
        days: [{ date: '2026-04-20', startTime: '10:00', endTime: '12:00' }],
      }),
    /Asia\/Tbilisi/,
  );
  assert.throws(
    () =>
      normalizeExistingSchedule({
        days: [
          { date: '2026-04-21', startTime: '10:00', endTime: '12:00' },
          { date: '2026-04-20', startTime: '10:00', endTime: '12:00' },
        ],
      }),
    /sorted/,
  );
});

test('buildEventScheduleMigrationProposal reports present malformed schedules without migrating them', () => {
  const proposal = buildEventScheduleMigrationProposal(
    legacyEvent({ schedule: null }),
  );

  assert.equal(proposal.status, 'ambiguous');
  assert.equal(proposal.reason, AMBIGUOUS_REASONS.MalformedExistingSchedule);
});

test('processEvents is idempotent and reports dry-run changes without writing', async () => {
  const stats = createStats(parseOptions([]));
  let updateCalled = false;

  await processEvents({
    options: parseOptions([]),
    stats,
    collection: {
      find: () =>
        createCursor([
          legacyEvent(),
          legacyEvent({
            _id: '507f1f77bcf86cd799439012',
            schedule: {
              timezone: 'Asia/Tbilisi',
              days: [
                {
                  date: '2026-04-20',
                  startTime: '10:00',
                  endTime: '12:00',
                },
              ],
            },
          }),
          legacyEvent({
            _id: '507f1f77bcf86cd799439013',
            startAt: 'bad-date',
          }),
          legacyEvent({
            _id: '507f1f77bcf86cd799439014',
            startAt: '2026-04-20T06:00:00.000Z',
            endAt: '2026-04-22T09:00:00.000Z',
          }),
        ]),
      updateOne: async () => {
        updateCalled = true;
      },
    },
  });

  assert.equal(updateCalled, false);
  assert.equal(stats.events.scanned, 4);
  assert.equal(stats.events.absentScheduleCandidates, 3);
  assert.equal(stats.events.alreadyScheduled, 1);
  assert.equal(stats.events.proposedMigrations, 1);
  assert.equal(stats.events.ambiguous.total, 2);
  assert.equal(
    stats.events.ambiguous.byReason[
      AMBIGUOUS_REASONS.MultiDayLegacyRangeRequiresReview
    ],
    1,
  );
  assert.equal(stats.manifest.entries, 1);
});

test('processEvents writes absent schedules with a conditional update', async () => {
  const options = parseOptions([
    '--write',
    '--confirm-production-backfill',
    '--manifest',
    createTempManifestPath(),
  ]);
  const stats = createStats(options);
  const updates = [];

  await processEvents({
    options,
    stats,
    collection: {
      find: () => createCursor([legacyEvent()]),
      updateOne: async (filter, update) => {
        updates.push({ filter, update });
        return { modifiedCount: 1 };
      },
    },
  });

  assert.equal(stats.events.updated, 1);
  assert.equal(stats.manifest.entries, 1);
  assert.deepEqual(updates[0].filter, {
    _id: '507f1f77bcf86cd799439011',
    schedule: { $exists: false },
  });
  assert.deepEqual(Object.keys(updates[0].update.$set), ['schedule']);
});

test('processEvents counts conditional-write skips when schedule appears concurrently', async () => {
  const options = parseOptions([
    '--write',
    '--confirm-production-backfill',
    '--manifest',
    createTempManifestPath(),
  ]);
  const stats = createStats(options);

  await processEvents({
    options,
    stats,
    collection: {
      find: () => createCursor([legacyEvent()]),
      updateOne: async () => ({ modifiedCount: 0 }),
    },
  });

  assert.equal(stats.events.updated, 0);
  assert.equal(stats.events.concurrentlySkipped, 1);
  assert.equal(stats.manifest.entries, 0);
});

test('createRollbackDecision reverts only matching manifest fingerprints', () => {
  const proposal = buildEventScheduleMigrationProposal(legacyEvent());
  const matching = createRollbackDecision(
    { _id: legacyEvent()._id, schedule: proposal.schedule },
    proposal.manifestEntry,
  );

  assert.equal(matching.status, 'revert');

  const mismatch = createRollbackDecision(
    {
      _id: legacyEvent()._id,
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [{ date: '2026-04-21', startTime: '10:00', endTime: '12:00' }],
      },
    },
    proposal.manifestEntry,
  );

  assert.equal(mismatch.status, 'skipped');
  assert.equal(mismatch.reason, 'fingerprintMismatch');
});

test('processRollback supports dry-run and write rollback decisions', async () => {
  const proposal = buildEventScheduleMigrationProposal(legacyEvent());
  const manifest = normalizeManifest({ entries: [proposal.manifestEntry] });
  const dryRunOptions = parseOptions([
    '--rollback-manifest',
    './manifest.json',
  ]);
  const dryRunStats = createStats(dryRunOptions);
  let updateCalled = false;

  await processRollback({
    options: dryRunOptions,
    stats: dryRunStats,
    manifest,
    collection: {
      findOne: async () => ({
        _id: legacyEvent()._id,
        schedule: proposal.schedule,
      }),
      updateOne: async () => {
        updateCalled = true;
      },
    },
  });

  assert.equal(updateCalled, false);
  assert.equal(dryRunStats.rollback.wouldRevert, 1);
  assert.equal(dryRunStats.rollback.reverted, 0);

  const writeOptions = parseOptions([
    '--rollback-manifest',
    './manifest.json',
    '--write',
    '--confirm-production-backfill',
  ]);
  const writeStats = createStats(writeOptions);

  await processRollback({
    options: writeOptions,
    stats: writeStats,
    manifest,
    collection: {
      findOne: async () => ({
        _id: legacyEvent()._id,
        schedule: proposal.schedule,
      }),
      updateOne: async (filter, update) => {
        assert.deepEqual(update, { $unset: { schedule: '' } });
        assert.equal(filter.schedule, proposal.schedule);
        return { modifiedCount: 1 };
      },
    },
  });

  assert.equal(writeStats.rollback.wouldRevert, 1);
  assert.equal(writeStats.rollback.reverted, 1);
});

test('readMongoConfig requires explicit database settings', () => {
  assert.throws(() => readMongoConfig({}), /MONGO_URL and MONGO_DBNAME/);
  assert.deepEqual(
    readMongoConfig({
      MONGO_URL: 'mongodb://example',
      MONGO_DBNAME: 'domData',
      MONGO_INITDB_ROOT_USERNAME: 'user',
      MONGO_INITDB_ROOT_PASSWORD: 'pass',
    }),
    {
      url: 'mongodb://example',
      dbName: 'domData',
      user: 'user',
      password: 'pass',
    },
  );
});

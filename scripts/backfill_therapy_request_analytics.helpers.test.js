const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createStats,
  processRequests,
  processSessions,
  readMongoConfig,
} = require('./backfill_therapy_request_analytics');
const {
  buildRequestCandidateQuery,
  buildRequestProposal,
  createRequestSample,
  mergeInference,
  parseOptions,
} = require('./backfill_therapy_request_analytics.helpers');

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

test('parseOptions keeps dry-run default and requires write confirmation', () => {
  assert.deepEqual(parseOptions([]), {
    write: false,
    confirmProductionBackfill: false,
    forceReclassify: false,
    limit: undefined,
    batchSize: 100,
    onlyRequests: false,
    onlySessions: false,
  });

  assert.throws(() => parseOptions(['--write']), /Refusing to write/);
  assert.deepEqual(
    parseOptions([
      '--write',
      '--confirm-production-backfill',
      '--limit',
      '10',
      '--batch-size=5',
      '--only-requests',
    ]),
    {
      write: true,
      confirmProductionBackfill: true,
      forceReclassify: false,
      limit: 10,
      batchSize: 5,
      onlyRequests: true,
      onlySessions: false,
    },
  );
});

test('buildRequestCandidateQuery targets missing analytics fields unless forced', () => {
  assert.deepEqual(buildRequestCandidateQuery({ forceReclassify: true }), {});

  const query = buildRequestCandidateQuery({});
  assert.equal(query.$or.length, 7);
  assert.ok(
    query.$or.some((entry) => entry['analyticsInference.clientGender']),
  );
});

test('mergeInference preserves existing detectedAt and review metadata', () => {
  const detectedAt = new Date('2026-01-01T00:00:00.000Z');
  const reviewedAt = new Date('2026-01-02T00:00:00.000Z');
  const merged = mergeInference(
    {
      value: 'unknown',
      confidence: 0.2,
      sources: ['previous'],
      reasons: ['previous'],
      detectedAt,
      reviewedAt,
      reviewedBy: 'admin-1',
      manual: false,
      selfReported: true,
    },
    {
      inference: {
        value: 'female',
        confidence: 0.8,
        sources: ['name'],
        reasons: ['signal'],
        detectedAt: new Date('2026-02-01T00:00:00.000Z'),
        manual: false,
      },
    },
  );

  assert.equal(merged.value, 'female');
  assert.equal(merged.detectedAt, detectedAt);
  assert.equal(merged.reviewedAt, reviewedAt);
  assert.equal(merged.reviewedBy, 'admin-1');
  assert.equal(merged.selfReported, true);
});

test('buildRequestProposal does not overwrite manual fields', () => {
  const request = {
    _id: 'request-1',
    name: 'Client',
    descr: 'Запрос про ребенка',
    clientGender: 'other',
    requestCategory: 'individual',
    topic: 'Manual topic',
    analyticsReviewRequired: false,
    analyticsInference: {
      clientGender: {
        value: 'other',
        confidence: 1,
        sources: ['admin'],
        reasons: ['manual'],
        detectedAt: new Date('2026-01-01T00:00:00.000Z'),
        reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
        reviewedBy: 'admin-1',
        manual: true,
      },
      requestCategory: {
        value: 'individual',
        confidence: 1,
        sources: ['admin'],
        reasons: ['manual'],
        manual: true,
      },
      topic: {
        value: 'Manual topic',
        confidence: 1,
        sources: ['admin'],
        reasons: ['manual'],
        manual: true,
      },
    },
  };

  const proposal = buildRequestProposal(request, null, {
    forceReclassify: true,
  });

  assert.equal(proposal.hasChanges, false);
  assert.equal(proposal.skippedManual, 3);
});

test('buildRequestProposal is idempotent for complete identical analytics', () => {
  const detectedAt = new Date('2026-01-01T00:00:00.000Z');
  const request = {
    _id: 'request-1',
    name: 'Client',
    descr: 'Семейный запрос про отношения',
    clientGender: 'unknown',
    requestCategory: 'family',
    topic: 'Семейный запрос про отношения',
    analyticsReviewRequired: true,
    analyticsInference: {
      clientGender: {
        value: 'unknown',
        confidence: 0.2,
        sources: ['name', 'descr', 'contacts'],
        reasons: ['No reliable persisted gender signal found'],
        detectedAt,
        manual: false,
      },
      requestCategory: {
        value: 'family',
        confidence: 0.84,
        sources: ['descr', 'name'],
        reasons: ['Matched request category signal "сем"'],
        detectedAt,
        manual: false,
      },
      topic: {
        value: 'Семейный запрос про отношения',
        confidence: 0.68,
        sources: ['descr'],
        reasons: ['Used the first meaningful request text fragment as topic'],
        detectedAt,
        manual: false,
      },
    },
  };

  const proposal = buildRequestProposal(request, null, {});

  assert.equal(proposal.hasChanges, false);
  assert.deepEqual(proposal.changedFields, []);
});

test('buildRequestProposal can clear review for high-confidence auto analytics', () => {
  const proposal = buildRequestProposal(
    {
      _id: 'request-1',
      name: 'Client',
      descr: 'Женщина ищет индивидуальную работу с тревогой',
    },
    null,
    {},
  );

  assert.equal(proposal.proposedSet.clientGender, 'female');
  assert.equal(proposal.proposedSet.requestCategory, 'individual');
  assert.equal(proposal.proposedSet.analyticsReviewRequired, false);
});

test('createRequestSample does not include client names', () => {
  const request = {
    _id: 'request-1',
    name: 'Client Name',
    descr: 'Женщина ищет индивидуальную работу с тревогой',
  };
  const proposal = buildRequestProposal(request, null, {});

  const sample = createRequestSample(request, proposal);

  assert.equal(Object.hasOwn(sample, 'name'), false);
  assert.equal(JSON.stringify(sample).includes('Client Name'), false);
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

test('processRequests isolates per-document failures', async () => {
  const stats = createStats(parseOptions([]));
  await processRequests({
    options: parseOptions([]),
    stats,
    collections: {
      therapyRequests: {
        find: () =>
          createCursor([
            {
              _id: 'request-1',
              user: 'user-1',
            },
          ]),
      },
      users: {
        findOne: async () => {
          throw new Error('bad user');
        },
      },
    },
  });

  assert.equal(stats.requests.failed, 1);
  assert.equal(stats.requests.failures[0]._id, 'request-1');
});

test('processSessions isolates per-document failures', async () => {
  const stats = createStats(parseOptions([]));
  await processSessions({
    options: parseOptions([]),
    stats,
    collections: {
      therapySessions: {
        find: () =>
          createCursor([
            {
              _id: 'session-1',
              psychologist: 'psychologist-1',
            },
          ]),
      },
      psychologists: {
        findOne: async () => {
          throw new Error('bad psychologist');
        },
      },
    },
  });

  assert.equal(stats.sessions.failed, 1);
  assert.equal(stats.sessions.failures[0]._id, 'session-1');
});

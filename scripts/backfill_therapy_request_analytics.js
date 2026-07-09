/**
 * Dry-run-first backfill for therapy request analytics.
 *
 * Dry run:
 *   node scripts/backfill_therapy_request_analytics.js
 *
 * Write deterministic changes:
 *   node scripts/backfill_therapy_request_analytics.js --write --confirm-production-backfill
 *
 * Useful options:
 *   --limit 100
 *   --batch-size 50
 *   --only-requests
 *   --only-sessions
 *   --force-reclassify
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const { MongoClient } = require('mongodb');
const {
  buildRequestCandidateQuery,
  buildRequestProposal,
  createRequestSample,
  createRequestSummary,
  idToString,
  parseOptions,
  summarizeRequestProposal,
} = require('./backfill_therapy_request_analytics.helpers');

const SAMPLE_LIMIT = 20;

function readMongoConfig(env = process.env) {
  if (!env.MONGO_URL || !env.MONGO_DBNAME) {
    throw new Error(
      'MONGO_URL and MONGO_DBNAME are required to run therapy request analytics backfill.',
    );
  }

  return {
    url: env.MONGO_URL,
    dbName: env.MONGO_DBNAME,
    user: env.MONGO_INITDB_ROOT_USERNAME,
    password: env.MONGO_INITDB_ROOT_PASSWORD,
  };
}

function createStats(options) {
  return {
    mode: options.write ? 'write' : 'dry-run',
    options,
    requests: {
      scanned: 0,
      candidates: 0,
      actualChanges: 0,
      updated: 0,
      failed: 0,
      manualFieldsSkipped: 0,
      summary: createRequestSummary(),
      samples: [],
      failures: [],
    },
    sessions: {
      scanned: 0,
      linkable: 0,
      linked: 0,
      ambiguous: 0,
      unlinked: 0,
      failed: 0,
      failures: [],
    },
  };
}

function cursorWithLimit(cursor, limit) {
  return limit ? cursor.limit(limit) : cursor;
}

async function flushBulk(collection, operations, statsPath, options) {
  if (!operations.length) {
    return;
  }

  if (options.write) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    statsPath.updated += result.modifiedCount || 0;
  }

  operations.length = 0;
}

async function processRequests({ collections, options, stats }) {
  const { therapyRequests, users } = collections;
  const requestQuery = buildRequestCandidateQuery(options);
  const requestCursor = cursorWithLimit(
    therapyRequests.find(requestQuery),
    options.limit,
  );
  const operations = [];

  while (await requestCursor.hasNext()) {
    const request = await requestCursor.next();
    if (!request) {
      continue;
    }

    stats.requests.scanned += 1;
    stats.requests.candidates += 1;

    let proposal;
    try {
      const user = request.user
        ? await users.findOne({ _id: request.user })
        : null;
      proposal = buildRequestProposal(request, user, options);
    } catch (error) {
      stats.requests.failed += 1;
      if (stats.requests.failures.length < SAMPLE_LIMIT) {
        stats.requests.failures.push({
          _id: idToString(request._id),
          error: error.message || String(error),
        });
      }
      continue;
    }

    stats.requests.manualFieldsSkipped += proposal.skippedManual;
    summarizeRequestProposal(stats.requests.summary, request, proposal);

    if (!proposal.hasChanges) {
      continue;
    }

    stats.requests.actualChanges += 1;
    if (stats.requests.samples.length < SAMPLE_LIMIT) {
      stats.requests.samples.push(createRequestSample(request, proposal));
    }

    operations.push({
      updateOne: {
        filter: { _id: request._id },
        update: { $set: proposal.set },
      },
    });

    if (operations.length >= options.batchSize) {
      await flushBulk(therapyRequests, operations, stats.requests, options);
    }
  }

  await flushBulk(therapyRequests, operations, stats.requests, options);
}

function findDeterministicClientRequest(psychologist, session) {
  const matchingClients = (psychologist?.clients || []).filter(
    (entry) => idToString(entry.user) === idToString(session.client),
  );
  const matchingRequestIds = matchingClients
    .map((entry) => entry.therapyRequest)
    .filter(Boolean)
    .map(idToString);
  const uniqueRequestIds = Array.from(new Set(matchingRequestIds));

  if (uniqueRequestIds.length !== 1) {
    return {
      status: uniqueRequestIds.length > 1 ? 'ambiguous' : 'unlinked',
      therapyRequest: undefined,
    };
  }

  return {
    status: 'linkable',
    therapyRequest: matchingClients.find(
      (entry) => idToString(entry.therapyRequest) === uniqueRequestIds[0],
    )?.therapyRequest,
  };
}

async function processSessions({ collections, options, stats }) {
  const { therapySessions, psychologists } = collections;
  const sessionCursor = cursorWithLimit(
    therapySessions.find({
      $or: [{ therapyRequest: { $exists: false } }, { therapyRequest: null }],
    }),
    options.limit,
  );
  const operations = [];

  while (await sessionCursor.hasNext()) {
    const session = await sessionCursor.next();
    if (!session) {
      continue;
    }

    stats.sessions.scanned += 1;
    let link;
    try {
      const psychologist = session.psychologist
        ? await psychologists.findOne({ _id: session.psychologist })
        : null;
      link = findDeterministicClientRequest(psychologist, session);
    } catch (error) {
      stats.sessions.failed += 1;
      if (stats.sessions.failures.length < SAMPLE_LIMIT) {
        stats.sessions.failures.push({
          _id: idToString(session._id),
          error: error.message || String(error),
        });
      }
      continue;
    }

    if (link.status === 'linkable') {
      stats.sessions.linkable += 1;
      operations.push({
        updateOne: {
          filter: { _id: session._id },
          update: { $set: { therapyRequest: link.therapyRequest } },
        },
      });
    } else if (link.status === 'ambiguous') {
      stats.sessions.ambiguous += 1;
    } else {
      stats.sessions.unlinked += 1;
    }

    if (operations.length >= options.batchSize) {
      await flushBulk(therapySessions, operations, stats.sessions, options);
    }
  }

  await flushBulk(therapySessions, operations, stats.sessions, options);
}

function printReadableSummary(stats) {
  console.log('\nTherapy request analytics backfill');
  console.log(`Mode: ${stats.mode}`);
  console.log(
    `Requests: scanned=${stats.requests.scanned}, candidates=${stats.requests.candidates}, actualChanges=${stats.requests.actualChanges}, updated=${stats.requests.updated}, failed=${stats.requests.failed}`,
  );
  console.log(
    `Request review: unknown=${stats.requests.summary.unknownCount}, reviewRequired=${stats.requests.summary.reviewRequiredCount}, manualFieldsSkipped=${stats.requests.manualFieldsSkipped}`,
  );
  console.log(
    `Topics: empty=${stats.requests.summary.topic.empty}, nonEmpty=${stats.requests.summary.topic.nonEmpty}`,
  );
  console.log(
    `Sessions: scanned=${stats.sessions.scanned}, linkable=${stats.sessions.linkable}, linked=${stats.sessions.linked}, ambiguous=${stats.sessions.ambiguous}, unlinked=${stats.sessions.unlinked}, failed=${stats.sessions.failed}`,
  );
  console.log('\nCurrent clientGender counts:');
  console.log(
    JSON.stringify(stats.requests.summary.currentClientGender, null, 2),
  );
  console.log('\nProposed clientGender counts:');
  console.log(
    JSON.stringify(stats.requests.summary.proposedClientGender, null, 2),
  );
  console.log('\nCurrent requestCategory counts:');
  console.log(
    JSON.stringify(stats.requests.summary.currentRequestCategory, null, 2),
  );
  console.log('\nProposed requestCategory counts:');
  console.log(
    JSON.stringify(stats.requests.summary.proposedRequestCategory, null, 2),
  );

  if (stats.requests.samples.length) {
    console.log('\nSample request changes:');
    console.log(JSON.stringify(stats.requests.samples, null, 2));
  }

  if (stats.requests.failures.length || stats.sessions.failures.length) {
    console.log('\nSample failures:');
    console.log(
      JSON.stringify(
        {
          requests: stats.requests.failures,
          sessions: stats.sessions.failures,
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
    const collections = {
      therapyRequests: db.collection('therapyrequests'),
      therapySessions: db.collection('therapysessions'),
      psychologists: db.collection('psychologists'),
      users: db.collection('users'),
    };

    if (!options.onlySessions) {
      await processRequests({ collections, options, stats });
    }

    if (!options.onlyRequests) {
      await processSessions({ collections, options, stats });
    }

    printReadableSummary(stats);
    console.log('\nStructured JSON:');
    console.log(JSON.stringify(stats, null, 2));
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
  findDeterministicClientRequest,
  processRequests,
  processSessions,
  readMongoConfig,
  run,
};

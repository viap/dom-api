function loadClassifierCore() {
  try {
    return require('../dist/therapy-requests/therapy-request-classifier.core');
  } catch (error) {
    throw new Error(
      `Compiled classifier core is required for analytics backfill. Run "npm run build" before running this script. ${
        error.message || error
      }`,
    );
  }
}

const {
  classifyTherapyRequestAnalytics,
  computeTherapyRequestAnalyticsReviewRequired,
  TherapyRequestCategory,
  TherapyRequestClientGender,
} = loadClassifierCore();

const CLIENT_GENDER = {
  FEMALE: TherapyRequestClientGender.Female,
  MALE: TherapyRequestClientGender.Male,
  OTHER: TherapyRequestClientGender.Other,
  UNKNOWN: TherapyRequestClientGender.Unknown,
};

const REQUEST_CATEGORY = {
  INDIVIDUAL: TherapyRequestCategory.Individual,
  FAMILY: TherapyRequestCategory.Family,
  GROUP: TherapyRequestCategory.Group,
  CHILD: TherapyRequestCategory.Child,
  UNKNOWN: TherapyRequestCategory.Unknown,
};

const ANALYTICS_FIELDS = ['clientGender', 'requestCategory'];

function parsePositiveInteger(rawValue, optionName) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return value;
}

function readOptionValue(argv, index, optionName) {
  const arg = argv[index];
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }

  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }

  return { value, nextIndex: index + 1 };
}

function parseOptions(argv = []) {
  const options = {
    write: false,
    confirmProductionBackfill: false,
    forceReclassify: false,
    limit: undefined,
    batchSize: 100,
    onlyRequests: false,
    onlySessions: false,
    cleanupTopic: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') {
      options.write = true;
    } else if (arg === '--confirm-production-backfill') {
      options.confirmProductionBackfill = true;
    } else if (arg === '--force-reclassify') {
      options.forceReclassify = true;
    } else if (arg === '--only-requests') {
      options.onlyRequests = true;
    } else if (arg === '--only-sessions') {
      options.onlySessions = true;
    } else if (arg === '--cleanup-topic') {
      options.cleanupTopic = true;
    } else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const parsed = readOptionValue(argv, i, '--limit');
      options.limit = parsePositiveInteger(parsed.value, '--limit');
      i = parsed.nextIndex;
    } else if (arg === '--batch-size' || arg.startsWith('--batch-size=')) {
      const parsed = readOptionValue(argv, i, '--batch-size');
      options.batchSize = parsePositiveInteger(parsed.value, '--batch-size');
      i = parsed.nextIndex;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.write && !options.confirmProductionBackfill) {
    throw new Error(
      'Refusing to write without --confirm-production-backfill. Run with both --write --confirm-production-backfill.',
    );
  }

  if (options.onlyRequests && options.onlySessions) {
    throw new Error('Use only one of --only-requests or --only-sessions');
  }

  return options;
}

function buildRequestCandidateQuery(options = {}) {
  if (options.cleanupTopic) {
    return {
      $or: [
        { topic: { $exists: true } },
        { 'analyticsInference.topic': { $exists: true } },
        { clientGender: { $exists: false } },
        { requestCategory: { $exists: false } },
        { analyticsReviewRequired: { $exists: false } },
        { 'analyticsInference.clientGender': { $exists: false } },
        { 'analyticsInference.requestCategory': { $exists: false } },
      ],
    };
  }

  if (options.forceReclassify) {
    return {};
  }

  return {
    $or: [
      { clientGender: { $exists: false } },
      { requestCategory: { $exists: false } },
      { analyticsReviewRequired: { $exists: false } },
      { 'analyticsInference.clientGender': { $exists: false } },
      { 'analyticsInference.requestCategory': { $exists: false } },
    ],
  };
}

function buildTopicCleanupQuery() {
  return {
    $or: [
      { topic: { $exists: true } },
      { 'analyticsInference.topic': { $exists: true } },
    ],
  };
}

function fieldIsManual(request, field) {
  return request.analyticsInference?.[field]?.manual === true;
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function fieldNeedsBackfill(request, field, options = {}) {
  if (options.forceReclassify) {
    return true;
  }

  return !hasOwn(request, field) || !request.analyticsInference?.[field];
}

function buildFieldProposal(
  request,
  user,
  field,
  options = {},
  now = new Date(),
) {
  const existingInference = request.analyticsInference?.[field];

  if (fieldIsManual(request, field)) {
    return {
      field,
      skippedManual: true,
      value: request[field] ?? existingInference?.value,
      inference: existingInference,
      changed: false,
    };
  }

  if (!fieldNeedsBackfill(request, field, options)) {
    return {
      field,
      skippedManual: false,
      value: request[field],
      inference: existingInference,
      changed: false,
    };
  }

  const classification = classifyTherapyRequestAnalytics(
    {
      name: request.name,
      descr: request.descr,
      user,
      contacts: request.contacts,
      current: request,
    },
    now,
  );
  return {
    field,
    skippedManual: false,
    value: classification[field],
    inference: classification.analyticsInference?.[field],
  };
}

function mergeInference(existingInference, proposal) {
  if (!proposal?.inference) {
    return existingInference;
  }

  if (existingInference?.manual) {
    return existingInference;
  }

  return {
    ...proposal.inference,
    detectedAt: existingInference
      ? existingInference.detectedAt
      : proposal.inference.detectedAt,
    reviewedAt: existingInference?.reviewedAt,
    reviewedBy: existingInference?.reviewedBy,
    manual: false,
    selfReported:
      proposal.inference.selfReported ?? existingInference?.selfReported,
  };
}

function normalizeForComparison(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForComparison);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeForComparison(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }

  return value;
}

function stableEqual(a, b) {
  return (
    JSON.stringify(normalizeForComparison(a)) ===
    JSON.stringify(normalizeForComparison(b))
  );
}

function computeReviewRequired(values, inference) {
  return computeTherapyRequestAnalyticsReviewRequired(values, inference);
}

function buildRequestProposal(request, user, options = {}, now = new Date()) {
  const fieldProposals = {};
  const values = {
    clientGender: request.clientGender,
    requestCategory: request.requestCategory,
  };
  const analyticsInference = { ...(request.analyticsInference || {}) };
  let skippedManual = 0;

  for (const field of ANALYTICS_FIELDS) {
    const proposal = buildFieldProposal(request, user, field, options, now);
    fieldProposals[field] = proposal;
    if (proposal.skippedManual) {
      skippedManual += 1;
      continue;
    }

    values[field] = proposal.value;
    analyticsInference[field] = mergeInference(
      request.analyticsInference?.[field],
      proposal,
    );
  }

  const proposedSet = {
    clientGender: values.clientGender || CLIENT_GENDER.UNKNOWN,
    requestCategory: values.requestCategory || REQUEST_CATEGORY.UNKNOWN,
    analyticsReviewRequired: computeReviewRequired(
      {
        clientGender: values.clientGender || CLIENT_GENDER.UNKNOWN,
        requestCategory: values.requestCategory || REQUEST_CATEGORY.UNKNOWN,
      },
      analyticsInference,
    ),
    analyticsInference,
  };

  const diff = diffRequestPatch(request, proposedSet);
  return {
    proposedSet,
    fieldProposals,
    skippedManual,
    ...diff,
  };
}

function buildTopicCleanupPatch(request) {
  const analyticsInference = { ...(request.analyticsInference || {}) };
  delete analyticsInference.topic;

  const clientGender = request.clientGender || CLIENT_GENDER.UNKNOWN;
  const requestCategory = request.requestCategory || REQUEST_CATEGORY.UNKNOWN;
  const analyticsReviewRequired = computeReviewRequired(
    { clientGender, requestCategory },
    analyticsInference,
  );
  const set = {};
  const unset = {};

  if (!stableEqual(request.analyticsReviewRequired, analyticsReviewRequired)) {
    set.analyticsReviewRequired = analyticsReviewRequired;
  }

  if (hasOwn(request, 'topic')) {
    unset.topic = '';
  }

  if (request.analyticsInference?.topic) {
    unset['analyticsInference.topic'] = '';
  }

  return {
    set,
    unset,
    hasChanges: Object.keys(set).length > 0 || Object.keys(unset).length > 0,
  };
}

function diffRequestPatch(request, proposedSet) {
  const set = {};
  const changedFields = [];

  for (const [field, value] of Object.entries(proposedSet)) {
    if (!stableEqual(request[field], value)) {
      set[field] = value;
      changedFields.push(field);
    }
  }

  return {
    set,
    changedFields,
    hasChanges: changedFields.length > 0,
  };
}

function idToString(value) {
  return value ? value.toString() : '';
}

function createCounter(keys = []) {
  return keys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function incrementCounter(counter, key) {
  const normalizedKey = key || 'missing';
  counter[normalizedKey] = (counter[normalizedKey] || 0) + 1;
}

function summarizeRequestProposal(summary, request, proposal) {
  const proposed = proposal.proposedSet;

  incrementCounter(summary.currentClientGender, request.clientGender);
  incrementCounter(summary.proposedClientGender, proposed.clientGender);
  incrementCounter(summary.currentRequestCategory, request.requestCategory);
  incrementCounter(summary.proposedRequestCategory, proposed.requestCategory);

  if (
    proposed.clientGender === CLIENT_GENDER.UNKNOWN ||
    proposed.requestCategory === REQUEST_CATEGORY.UNKNOWN
  ) {
    summary.unknownCount += 1;
  }

  if (proposed.analyticsReviewRequired) {
    summary.reviewRequiredCount += 1;
  }
}

function createRequestSummary() {
  return {
    currentClientGender: createCounter(Object.values(CLIENT_GENDER)),
    proposedClientGender: createCounter(Object.values(CLIENT_GENDER)),
    currentRequestCategory: createCounter(Object.values(REQUEST_CATEGORY)),
    proposedRequestCategory: createCounter(Object.values(REQUEST_CATEGORY)),
    unknownCount: 0,
    reviewRequiredCount: 0,
  };
}

function createRequestSample(request, proposal) {
  const inference = proposal.proposedSet.analyticsInference || {};
  return {
    _id: idToString(request._id),
    changedFields: proposal.changedFields,
    existing: {
      clientGender: request.clientGender,
      requestCategory: request.requestCategory,
      analyticsReviewRequired: request.analyticsReviewRequired,
    },
    proposed: {
      clientGender: proposal.proposedSet.clientGender,
      requestCategory: proposal.proposedSet.requestCategory,
      analyticsReviewRequired: proposal.proposedSet.analyticsReviewRequired,
    },
    inference: Object.fromEntries(
      ANALYTICS_FIELDS.map((field) => [
        field,
        {
          confidence: inference[field]?.confidence,
          reasons: inference[field]?.reasons || [],
          sources: inference[field]?.sources || [],
          manual: inference[field]?.manual === true,
          selfReported: inference[field]?.selfReported === true,
        },
      ]),
    ),
  };
}

module.exports = {
  ANALYTICS_FIELDS,
  CLIENT_GENDER,
  REQUEST_CATEGORY,
  buildFieldProposal,
  buildRequestCandidateQuery,
  buildRequestProposal,
  buildTopicCleanupPatch,
  buildTopicCleanupQuery,
  createRequestSample,
  createRequestSummary,
  diffRequestPatch,
  fieldNeedsBackfill,
  mergeInference,
  parseOptions,
  stableEqual,
  summarizeRequestProposal,
  idToString,
};

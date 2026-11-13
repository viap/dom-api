const crypto = require('node:crypto');

const LEGACY_ACTIVE = new Set(['planned', 'registration_open', 'ongoing']);
const CANONICAL = new Set(['draft', 'active', 'cancelled', 'completed']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = stable(value[key]);
        return result;
      }, {});
  }
  return value;
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function relevantFields(event) {
  return {
    status: event.status,
    ...(Object.prototype.hasOwnProperty.call(event, 'capacity')
      ? { capacity: event.capacity }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(
      event.registration || {},
      'maxParticipants',
    )
      ? { maxParticipants: event.registration.maxParticipants }
      : {}),
  };
}

function buildProposal(event) {
  const original = relevantFields(event);
  const sourceRevision = Number.isInteger(event.__v) ? event.__v : undefined;
  const sourceFingerprint = fingerprint(original);
  const status = LEGACY_ACTIVE.has(event.status)
    ? 'active'
    : CANONICAL.has(event.status)
    ? event.status
    : null;
  const capacity = positiveInteger(event.capacity);
  const legacy = positiveInteger(event.registration?.maxParticipants);
  const invalidCapacity =
    Object.prototype.hasOwnProperty.call(event, 'capacity') &&
    capacity === undefined;
  const invalidLegacy =
    Object.prototype.hasOwnProperty.call(
      event.registration || {},
      'maxParticipants',
    ) && legacy === undefined;

  if (!status) {
    return {
      status: 'unresolved',
      reason: 'unknownStatus',
      original,
      sourceRevision,
      sourceFingerprint,
    };
  }
  if (invalidCapacity || invalidLegacy) {
    return {
      status: 'unresolved',
      reason: 'invalidCapacity',
      original,
      sourceRevision,
      sourceFingerprint,
    };
  }
  if (capacity !== undefined && legacy !== undefined && capacity !== legacy) {
    return {
      status: 'unresolved',
      reason: 'capacityConflict',
      original,
      sourceRevision,
      sourceFingerprint,
    };
  }

  const set = {};
  const unset = {};
  if (status !== event.status) set.status = status;
  if (capacity === undefined && legacy !== undefined) set.capacity = legacy;
  if (legacy !== undefined) unset['registration.maxParticipants'] = '';
  if (!Object.keys(set).length && !Object.keys(unset).length) {
    return {
      status: 'noop',
      original,
      sourceRevision,
      sourceFingerprint,
      produced: original,
      producedFingerprint: sourceFingerprint,
    };
  }

  const produced = {
    status,
    ...(capacity ?? legacy ? { capacity: capacity ?? legacy } : {}),
  };
  const producedRevision = (sourceRevision ?? 0) + 1;
  const mutation = { set, unset };
  return {
    status: 'ready',
    original,
    sourceRevision,
    sourceFingerprint,
    produced,
    producedRevision,
    producedFingerprint: fingerprint(produced),
    mutation,
    mutationChecksum: fingerprint(mutation),
  };
}

function sourcePredicate(event, proposal) {
  return {
    _id: event._id,
    ...(proposal.sourceRevision === undefined
      ? { __v: { $exists: false } }
      : { __v: proposal.sourceRevision }),
    status: event.status,
    ...(Object.prototype.hasOwnProperty.call(event, 'capacity')
      ? { capacity: event.capacity }
      : { capacity: { $exists: false } }),
    ...(Object.prototype.hasOwnProperty.call(
      event.registration || {},
      'maxParticipants',
    )
      ? { 'registration.maxParticipants': event.registration.maxParticipants }
      : { 'registration.maxParticipants': { $exists: false } }),
  };
}

function migrationUpdate(proposal) {
  return {
    ...(Object.keys(proposal.mutation.set).length
      ? { $set: proposal.mutation.set }
      : {}),
    ...(Object.keys(proposal.mutation.unset).length
      ? { $unset: proposal.mutation.unset }
      : {}),
    $inc: { __v: 1 },
  };
}

function rollbackPredicate(entry) {
  return {
    _id: entry._id,
    __v: entry.producedRevision,
    ...entry.produced,
    ...(!Object.prototype.hasOwnProperty.call(entry.produced, 'capacity')
      ? { capacity: { $exists: false } }
      : {}),
    'registration.maxParticipants': { $exists: false },
  };
}

function rollbackUpdate(entry) {
  const set = { status: entry.original.status };
  const unset = {};
  if (Object.prototype.hasOwnProperty.call(entry.original, 'capacity')) {
    set.capacity = entry.original.capacity;
  } else {
    unset.capacity = '';
  }
  if (Object.prototype.hasOwnProperty.call(entry.original, 'maxParticipants')) {
    set['registration.maxParticipants'] = entry.original.maxParticipants;
  } else {
    unset['registration.maxParticipants'] = '';
  }
  return {
    $set: set,
    ...(Object.keys(unset).length ? { $unset: unset } : {}),
    $inc: { __v: 1 },
  };
}

module.exports = {
  buildProposal,
  fingerprint,
  migrationUpdate,
  relevantFields,
  rollbackPredicate,
  rollbackUpdate,
  sourcePredicate,
};

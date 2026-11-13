const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildProposal,
  migrationUpdate,
  rollbackPredicate,
  rollbackUpdate,
  sourcePredicate,
} = require('./migrate_event_lifecycle_capacity.helpers');

test('dry-run proposal canonicalizes legacy status and legacy-only capacity', () => {
  const event = {
    _id: 'event',
    __v: 4,
    status: 'registration_open',
    registration: { isOpen: true, maxParticipants: 20 },
  };
  const proposal = buildProposal(event);
  assert.equal(proposal.status, 'ready');
  assert.deepEqual(proposal.mutation, {
    set: { status: 'active', capacity: 20 },
    unset: { 'registration.maxParticipants': '' },
  });
  assert.deepEqual(sourcePredicate(event, proposal), {
    _id: 'event',
    __v: 4,
    status: 'registration_open',
    capacity: { $exists: false },
    'registration.maxParticipants': 20,
  });
  assert.deepEqual(migrationUpdate(proposal).$inc, { __v: 1 });
});

test('conflicts and invalid values are unresolved and never auto-resolved', () => {
  assert.equal(
    buildProposal({
      status: 'active',
      capacity: 10,
      registration: { maxParticipants: 20 },
    }).reason,
    'capacityConflict',
  );
  assert.equal(
    buildProposal({ status: 'mystery', registration: {} }).reason,
    'unknownStatus',
  );
  assert.equal(
    buildProposal({ status: 'active', capacity: 0, registration: {} }).reason,
    'invalidCapacity',
  );
  assert.equal(
    buildProposal({
      status: 'active',
      capacity: 0,
      registration: { maxParticipants: 20 },
    }).reason,
    'invalidCapacity',
  );
});

test('rollback is monotonic and predicates on produced revision and fields', () => {
  const entry = {
    _id: 'event',
    producedRevision: 5,
    produced: { status: 'active', capacity: 20 },
    original: { status: 'planned', maxParticipants: 20 },
  };
  assert.deepEqual(rollbackPredicate(entry), {
    _id: 'event',
    __v: 5,
    status: 'active',
    capacity: 20,
    'registration.maxParticipants': { $exists: false },
  });
  const update = rollbackUpdate(entry);
  assert.deepEqual(update.$inc, { __v: 1 });
  assert.equal(update.$set.status, 'planned');
  assert.equal(update.$set['registration.maxParticipants'], 20);
  assert.equal(update.$unset.capacity, '');
});

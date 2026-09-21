const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_HEROICON_TO_LUCIDE,
  buildHeroIconMigrationProposal,
  mergeMappings,
  parseOptions,
} = require('./migrate_heroicons_to_lucide.helpers');
const {
  applyCollectionProposals,
  assertWriteIsSafe,
  collectCollectionProposals,
  createStats,
} = require('./migrate_heroicons_to_lucide');

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

function documentWithHeroIcon(icon, overrides = {}) {
  return {
    _id: 'hero-document-1',
    blocks: [
      { id: 'text', type: 'richText', content: 'Unchanged' },
      {
        id: 'hero',
        type: 'hero',
        items: [{ title: 'Card', icon }],
      },
    ],
    ...overrides,
  };
}

test('Heroicon migration options default to dry-run and require explicit write confirmation', () => {
  assert.deepEqual(parseOptions([]), {
    write: false,
    confirmProductionMigration: false,
    limit: undefined,
    mappingPath: undefined,
    manifestPath: undefined,
  });
  assert.throws(() => parseOptions(['--write']), /Refusing to write/);
  assert.deepEqual(
    parseOptions([
      '--write',
      '--confirm-production-migration',
      '--mapping',
      './heroicons.json',
      '--limit=5',
    ]),
    {
      write: true,
      confirmProductionMigration: true,
      limit: 5,
      mappingPath: './heroicons.json',
      manifestPath: undefined,
    },
  );
});

test('Heroicon migration converts reviewed values and leaves non-Hero blocks untouched', () => {
  const proposal = buildHeroIconMigrationProposal(
    documentWithHeroIcon('AcademicCapIcon'),
    DEFAULT_HEROICON_TO_LUCIDE,
  );

  assert.equal(proposal.changed, true);
  assert.deepEqual(proposal.changedIcons, [
    { from: 'AcademicCapIcon', to: 'GraduationCap' },
  ]);
  assert.equal(proposal.migratedBlocks[0].content, 'Unchanged');
  assert.equal(proposal.migratedBlocks[1].items[0].icon, 'GraduationCap');
});

test('Heroicon migration converts the production ChevronDownIcon value to ChevronDown', () => {
  const proposal = buildHeroIconMigrationProposal(
    documentWithHeroIcon('ChevronDownIcon'),
    DEFAULT_HEROICON_TO_LUCIDE,
  );

  assert.deepEqual(proposal.changedIcons, [
    { from: 'ChevronDownIcon', to: 'ChevronDown' },
  ]);
  assert.equal(proposal.migratedBlocks[1].items[0].icon, 'ChevronDown');
});

test('Heroicon migration reports unmapped legacy values and treats canonical Lucide values as unchanged', () => {
  const unknown = buildHeroIconMigrationProposal(
    documentWithHeroIcon('UnknownHeroIcon'),
    DEFAULT_HEROICON_TO_LUCIDE,
  );
  const canonical = buildHeroIconMigrationProposal(
    documentWithHeroIcon('GraduationCap'),
    DEFAULT_HEROICON_TO_LUCIDE,
  );

  assert.deepEqual(unknown.unmappedLegacyIconNames, ['UnknownHeroIcon']);
  assert.equal(unknown.changed, false);
  assert.equal(canonical.changed, false);
  assert.deepEqual(canonical.unmappedLegacyIconNames, []);
});

test('Heroicon migration refuses apply mode before writes when any legacy name is unmapped', () => {
  const options = parseOptions(['--write', '--confirm-production-migration']);
  const stats = createStats(options);
  stats.unmappedLegacyIconNames = ['UnknownHeroIcon'];

  assert.throws(() => assertWriteIsSafe(options, stats), /Refusing to write/);
});

test('Heroicon migration merges reviewed external mappings without replacing defaults', () => {
  assert.deepEqual(mergeMappings({ ArrowRightIcon: 'ArrowRight' }), {
    AcademicCapIcon: 'GraduationCap',
    ArrowRightIcon: 'ArrowRight',
    ChevronDownIcon: 'ChevronDown',
  });
  assert.throws(
    () => mergeMappings({ AcademicCapIcon: 'BookOpen' }),
    /conflicts with the reviewed default/,
  );
});

test('Heroicon migration collects Page and Event proposals before applying idempotent writes', async () => {
  const options = parseOptions([]);
  const stats = createStats(options);
  const page = documentWithHeroIcon('AcademicCapIcon');
  const event = documentWithHeroIcon('AcademicCapIcon', {
    _id: 'hero-event-1',
  });
  const pageProposals = await collectCollectionProposals({
    collection: { find: () => createCursor([page]) },
    collectionName: 'pages',
    mapping: DEFAULT_HEROICON_TO_LUCIDE,
    options,
    stats,
  });
  const eventProposals = await collectCollectionProposals({
    collection: { find: () => createCursor([event]) },
    collectionName: 'events',
    mapping: DEFAULT_HEROICON_TO_LUCIDE,
    options,
    stats,
  });
  const writes = [];

  const entries = await applyCollectionProposals({
    collection: {
      async updateOne(filter, update) {
        writes.push({ filter, update });
        return { modifiedCount: 1 };
      },
    },
    collectionName: 'pages',
    proposals: pageProposals,
    stats,
  });

  assert.equal(pageProposals.length, 1);
  assert.equal(eventProposals.length, 1);
  assert.equal(stats.unmappedLegacyIconNames.length, 0);
  assert.equal(writes.length, 1);
  assert.equal(entries[0].changes[0].to, 'GraduationCap');
  assert.equal(stats.updated, 1);
});

test('Heroicon migration counts each legacy icon occurrence for the dry-run report', () => {
  const proposal = buildHeroIconMigrationProposal(
    documentWithHeroIcon('AcademicCapIcon', {
      blocks: [
        {
          type: 'hero',
          items: [{ icon: 'AcademicCapIcon' }, { icon: 'AcademicCapIcon' }],
        },
      ],
    }),
    DEFAULT_HEROICON_TO_LUCIDE,
  );

  assert.equal(proposal.legacyIconOccurrences, 2);
  assert.deepEqual(proposal.legacyIconNames, ['AcademicCapIcon']);
});

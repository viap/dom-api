const DEFAULT_HEROICON_TO_LUCIDE = Object.freeze({
  AcademicCapIcon: 'GraduationCap',
  ChevronDownIcon: 'ChevronDown',
});

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

function parsePositiveInteger(rawValue, optionName) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return value;
}

function parseOptions(argv = []) {
  const options = {
    write: false,
    confirmProductionMigration: false,
    limit: undefined,
    mappingPath: undefined,
    manifestPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      options.write = true;
    } else if (arg === '--confirm-production-migration') {
      options.confirmProductionMigration = true;
    } else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const parsed = readOptionValue(argv, index, '--limit');
      options.limit = parsePositiveInteger(parsed.value, '--limit');
      index = parsed.nextIndex;
    } else if (arg === '--mapping' || arg.startsWith('--mapping=')) {
      const parsed = readOptionValue(argv, index, '--mapping');
      options.mappingPath = parsed.value;
      index = parsed.nextIndex;
    } else if (arg === '--manifest' || arg.startsWith('--manifest=')) {
      const parsed = readOptionValue(argv, index, '--manifest');
      options.manifestPath = parsed.value;
      index = parsed.nextIndex;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.write && !options.confirmProductionMigration) {
    throw new Error(
      'Refusing to write without --confirm-production-migration. Run with both --write --confirm-production-migration.',
    );
  }

  return options;
}

function normalizeMapping(rawMapping) {
  if (
    !rawMapping ||
    typeof rawMapping !== 'object' ||
    Array.isArray(rawMapping)
  ) {
    throw new Error('Heroicon mapping must be a JSON object of string pairs');
  }

  const mapping = {};
  for (const [legacyName, lucideName] of Object.entries(rawMapping)) {
    if (
      typeof legacyName !== 'string' ||
      !legacyName.endsWith('Icon') ||
      typeof lucideName !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9]*$/.test(lucideName)
    ) {
      throw new Error(
        `Invalid Heroicon mapping entry for ${JSON.stringify(legacyName)}`,
      );
    }
    mapping[legacyName] = lucideName;
  }

  return mapping;
}

function mergeMappings(overrideMapping = {}) {
  const normalizedOverrides = normalizeMapping(overrideMapping);

  for (const [legacyName, lucideName] of Object.entries(normalizedOverrides)) {
    const defaultName = DEFAULT_HEROICON_TO_LUCIDE[legacyName];
    if (defaultName && defaultName !== lucideName) {
      throw new Error(
        `Mapping override for ${legacyName} conflicts with the reviewed default ${defaultName}`,
      );
    }
  }

  return {
    ...DEFAULT_HEROICON_TO_LUCIDE,
    ...normalizedOverrides,
  };
}

function isLegacyHeroiconName(value) {
  return typeof value === 'string' && value.endsWith('Icon');
}

function buildHeroIconMigrationProposal(document, mapping) {
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  const legacyIconNames = new Set();
  const unmappedLegacyIconNames = new Set();
  const changedIcons = [];
  let legacyIconOccurrences = 0;
  let changed = false;

  const migratedBlocks = blocks.map((block) => {
    if (!block || block.type !== 'hero' || !Array.isArray(block.items)) {
      return block;
    }

    let blockChanged = false;
    const items = block.items.map((item) => {
      if (!item || typeof item.icon !== 'string') {
        return item;
      }

      const icon = item.icon.trim();
      if (!isLegacyHeroiconName(icon)) {
        return item;
      }

      legacyIconOccurrences += 1;
      legacyIconNames.add(icon);
      const lucideIcon = mapping[icon];
      if (!lucideIcon) {
        unmappedLegacyIconNames.add(icon);
        return item;
      }

      blockChanged = true;
      changed = true;
      changedIcons.push({ from: icon, to: lucideIcon });
      return { ...item, icon: lucideIcon };
    });

    return blockChanged ? { ...block, items } : block;
  });

  return {
    changed,
    originalBlocks: blocks,
    migratedBlocks,
    legacyIconNames: Array.from(legacyIconNames).sort(),
    unmappedLegacyIconNames: Array.from(unmappedLegacyIconNames).sort(),
    changedIcons,
    legacyIconOccurrences,
  };
}

module.exports = {
  DEFAULT_HEROICON_TO_LUCIDE,
  buildHeroIconMigrationProposal,
  isLegacyHeroiconName,
  mergeMappings,
  normalizeMapping,
  parseOptions,
};

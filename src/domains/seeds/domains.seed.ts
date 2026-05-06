import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import { cwd } from 'process';
import { DomainCode } from '../enums/domain-code.enum';
import { Domain, domainSchema } from '../schemas/domain.schema';

function loadEnvFile(envPath: string): void {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    // Allow the script to rely on pre-exported env vars if the file is absent.
  }
}

async function seedDomains() {
  loadEnvFile(cwd() + '/config/.env');

  if (!process.env.MONGO_URL) {
    throw new Error('MONGO_URL is required for domain seeding');
  }

  await mongoose.connect(process.env.MONGO_URL, {
    dbName: process.env.MONGO_DBNAME,
    user: process.env.MONGO_INITDB_ROOT_USERNAME,
    pass: process.env.MONGO_INITDB_ROOT_PASSWORD,
  });

  const DomainModel = mongoose.model(Domain.name, domainSchema);
  const seeds = [
    {
      code: DomainCode.PsychCenter,
      title: 'Психологический центр',
      slug: 'psych-center',
      order: 1,
    },
    {
      code: DomainCode.Community,
      title: 'Комьюнити',
      slug: 'community',
      order: 2,
    },
    {
      code: DomainCode.Academy,
      title: 'Академия',
      slug: 'academy',
      order: 3,
    },
    {
      code: DomainCode.PsychSchool,
      title: 'Психологическая школа',
      slug: 'psych-school',
      order: 4,
    },
  ];

  for (const seed of seeds) {
    await DomainModel.updateOne(
      { code: seed.code },
      { $setOnInsert: { ...seed, isActive: true, seo: {} } },
      { upsert: true },
    );
  }
}

seedDomains()
  .then(async () => {
    await mongoose.disconnect();
    console.log('Domains seeded successfully');
  })
  .catch(async (error) => {
    console.error('Failed to seed domains:', error);
    await mongoose.disconnect();
    process.exit(1);
  });

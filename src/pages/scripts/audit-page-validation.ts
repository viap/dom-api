import { readFileSync } from 'fs';
import { cwd } from 'process';
import mongoose from 'mongoose';
import { auditStoredPages } from '../utils/page-validation-audit';

function loadEnvFile(envPath: string): void {
  try {
    readFileSync(envPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .forEach((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value.replace(/^['"]|['"]$/g, '');
        }
      });
  } catch (_error) {
    // Missing local config is fine when variables are already exported.
  }
}

async function run(): Promise<void> {
  loadEnvFile(`${cwd()}/config/.env`);

  if (!process.env.MONGO_URL || !process.env.MONGO_DBNAME) {
    throw new Error(
      'MONGO_URL and MONGO_DBNAME are required to audit page validation.',
    );
  }

  const connection = await mongoose
    .createConnection(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DBNAME,
      user: process.env.MONGO_INITDB_ROOT_USERNAME,
      pass: process.env.MONGO_INITDB_ROOT_PASSWORD,
      autoIndex: false,
      autoCreate: false,
    })
    .asPromise();

  try {
    const summary = await auditStoredPages(connection);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.invalidPages > 0) {
      process.exitCode = 2;
    }
  } finally {
    await connection.close();
  }
}

run().catch(async (error) => {
  console.error(
    error instanceof Error ? error.message : 'Infrastructure error',
  );
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {
    // no-op
  }
  process.exitCode = 1;
});

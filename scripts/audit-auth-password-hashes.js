#!/usr/bin/env node
'use strict';

const { readFileSync } = require('fs');
const { cwd } = require('process');
const mongoose = require('mongoose');

function loadEnvFile(envPath) {
  try {
    const raw = readFileSync(envPath, 'utf8');
    raw
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
    // Ignore missing file and rely on already exported env vars.
  }
}

async function run() {
  loadEnvFile(cwd() + '/config/.env');

  if (!process.env.MONGO_URL || !process.env.MONGO_DBNAME) {
    throw new Error(
      'MONGO_URL and MONGO_DBNAME are required to run password hash audit.',
    );
  }

  await mongoose.connect(process.env.MONGO_URL, {
    dbName: process.env.MONGO_DBNAME,
    user: process.env.MONGO_INITDB_ROOT_USERNAME,
    pass: process.env.MONGO_INITDB_ROOT_PASSWORD,
  });

  const users = mongoose.connection.db.collection('users');

  const invalidHashRegex = { $not: /^\$2[aby]\$\d{2}\$.+/ };
  const usersWithInvalidHash = await users
    .find({
      login: { $exists: true, $type: 'string', $ne: '' },
      password: invalidHashRegex,
    })
    .project({ login: 1, password: 1 })
    .toArray();

  const usersWithMissingPassword = await users
    .find({
      login: { $exists: true, $type: 'string', $ne: '' },
      $or: [{ password: { $exists: false } }, { password: null }, { password: '' }],
    })
    .project({ login: 1 })
    .toArray();

  const summary = {
    checkedAt: new Date().toISOString(),
    totalInvalidHashUsers: usersWithInvalidHash.length,
    totalMissingPasswordUsers: usersWithMissingPassword.length,
    invalidHashLogins: usersWithInvalidHash.map((user) => user.login),
    missingPasswordLogins: usersWithMissingPassword.map((user) => user.login),
  };

  console.log(JSON.stringify(summary, null, 2));

  await mongoose.disconnect();

  if (summary.totalInvalidHashUsers > 0 || summary.totalMissingPasswordUsers > 0) {
    process.exitCode = 2;
  }
}

run().catch(async (error) => {
  console.error(error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {
    // no-op
  }
  process.exit(1);
});

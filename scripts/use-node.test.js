const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const LIB = path.join(__dirname, 'deploy', 'lib.sh');

// Runs use_node from a copy of lib.sh in a temp repo layout, with a stub
// `node` printing nodeVersion first on PATH and no nvm, so a real nvm on the
// machine cannot override the stub.
function runUseNode({ nvmrc, nodeVersion }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'use-node-'));
  const deployDir = path.join(root, 'scripts', 'deploy');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(deployDir, { recursive: true });
  fs.mkdirSync(binDir);
  fs.copyFileSync(LIB, path.join(deployDir, 'lib.sh'));
  if (nvmrc !== undefined) fs.writeFileSync(path.join(root, '.nvmrc'), nvmrc);
  fs.writeFileSync(
    path.join(binDir, 'node'),
    `#!/bin/sh\necho ${nodeVersion}\n`,
    { mode: 0o755 },
  );

  const result = spawnSync(
    'bash',
    ['-c', `source "${path.join(deployDir, 'lib.sh')}"; use_node`],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NVM_DIR: path.join(root, 'no-nvm'),
        PATH: `${binDir}:/usr/bin:/bin`,
      },
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
  return result;
}

test('use_node passes when node matches the .nvmrc major', () => {
  const result = runUseNode({ nvmrc: '22\n', nodeVersion: 'v22.23.4' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('use_node fails before any PM2 action on another major', () => {
  const result = runUseNode({ nvmrc: '22\n', nodeVersion: 'v20.18.1' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Node\.js 22 required\. Got: v20\.18\.1/);
});

test('use_node fails when .nvmrc is missing', () => {
  const result = runUseNode({ nodeVersion: 'v22.23.4' });
  assert.notEqual(result.status, 0);
});

test('use_node rejects a full version in .nvmrc (bare major only)', () => {
  const result = runUseNode({ nvmrc: '22.23.4\n', nodeVersion: 'v22.23.4' });
  assert.notEqual(result.status, 0);
});

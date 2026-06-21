import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createFileTestWorkspace, writeRegistryYaml } from './helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../src/cli.ts');

test('validate exits 0 for a valid registry yaml', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
characters:
  mike: { names: ["Mike"] }
groups:
  g1:
    characters: ["mike"]
    sheets:
      s1: { path: "img.png", description: "desc" }
`);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'validate', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid character registry:/);
  assert.match(result.stdout, /index\.yaml/);
  assert.equal(result.stderr, '');
});

test('validate exits 1 for an invalid registry yaml without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
characters:
  mike: { names: ["Mike"] }
groups:
  g1:
    characters: ["ghost"]
    sheets: {}
`);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'validate', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: Group "g1" references missing character "ghost"/);
  assert.doesNotMatch(result.stderr, /at Command\./);
});

test('list-all exits 1 for an invalid registry yaml without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
characters:
  mike: { names: ["Mike"] }
groups:
  g1:
    characters: ["ghost"]
    sheets: {}
`);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'list-all', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: Group "g1" references missing character "ghost"/);
  assert.doesNotMatch(result.stderr, /at Command\./);
});

test('get-sheet commands report missing sheets without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
characters:
  mike: { names: ["Mike"] }
groups:
  g1:
    characters: ["mike"]
    sheets: {}
`);

  for (const command of ['get-sheet-info', 'get-sheet-path']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', cliPath, command, '-f', workspace.yamlPath, 'g1', 'missing'],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: no valid character sheet of g1:missing/);
    assert.doesNotMatch(result.stderr, /at Command\./);
  }
});

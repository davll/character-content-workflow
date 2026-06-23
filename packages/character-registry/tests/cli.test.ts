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
      s1: { path: "img.png", summary: "desc" }
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

test('get-sheet-info outputs canonical prompt building descriptions', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
characters:
  mike: { names: ["Mike"] }
groups:
  g1:
    characters: ["mike"]
    prompt_building:
      descriptions:
        style:
          - group style
      constraints:
        - group constraint
      system_instructions:
        - group instruction
    sheets:
      s1:
        path: "img.png"
        summary: "desc"
        prompt_building:
          descriptions:
            style:
              - sheet style
            outfit_details:
              - sheet outfit
          constraints:
            - sheet constraint
          system_instructions:
            - sheet instruction
`);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'get-sheet-info', '-f', workspace.yamlPath, 'g1', 's1'],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /summary: desc/);
  assert.match(result.stdout, /prompt_building:/);
  assert.match(result.stdout, /descriptions:/);
  assert.match(result.stdout, /style:/);
  assert.match(result.stdout, /- group style/);
  assert.match(result.stdout, /- sheet style/);
  assert.match(result.stdout, /outfit_details:/);
  assert.match(result.stdout, /- sheet outfit/);
  assert.doesNotMatch(result.stdout, /^description:/m);
  assert.doesNotMatch(result.stdout, /segments:/);
  assert.equal(result.stderr, '');
});

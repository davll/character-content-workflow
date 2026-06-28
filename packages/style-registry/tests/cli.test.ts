import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createFileTestWorkspace, writeRegistryYaml } from './helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../src/cli.ts');

const validRegistry = `
styles:
  paper_craft:
    names:
      - paper craft
      - paper cutout
      - 紙雕
    summary: Soft cute layered paper craft style with simplified handcrafted shapes.
    prompt_building:
      descriptions:
        rendering:
          - Layered cut-paper construction with visible paper fibers and softly rounded edges.
        texture:
          - Tactile paper texture and stacked paper depth.
      constraints:
        - Preserve character identity while simplifying fine detail.
      system_instructions:
        - Apply style instructions after character identity and outfit constraints.
`;

test('validate exits 0 for a valid style registry yaml', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistry);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'validate', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid style registry:/);
  assert.equal(result.stderr, '');
});

test('validate exits 1 for malformed entries without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
styles:
  BadStyle:
    names: paper craft
    summary: bad
`);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'validate', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error:/);
  assert.doesNotMatch(result.stderr, /at Command\./);
});

test('list-all outputs summaries without full prompt-building detail', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistry);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'list-all', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /styles:/);
  assert.match(result.stdout, /id: paper_craft/);
  assert.match(result.stdout, /summary: Soft cute layered paper craft style/);
  assert.doesNotMatch(result.stdout, /prompt_building:/);
  assert.doesNotMatch(result.stdout, /Layered cut-paper construction/);
  assert.equal(result.stderr, '');
});

test('get-style-info outputs complete prompt-building data', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistry);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'get-style-info', '-f', workspace.yamlPath, 'paper_craft'],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /id: paper_craft/);
  assert.match(result.stdout, /prompt_building:/);
  assert.match(result.stdout, /rendering:/);
  assert.match(result.stdout, /Layered cut-paper construction/);
  assert.match(result.stdout, /constraints:/);
  assert.match(result.stdout, /system_instructions:/);
  assert.equal(result.stderr, '');
});

test('get-style-info reports missing styles without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistry);

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'get-style-info', '-f', workspace.yamlPath, 'missing_style'],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: no valid style profile missing_style/);
  assert.doesNotMatch(result.stderr, /at Command\./);
});

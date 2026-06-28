import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createFileTestWorkspace, validRegistryYaml, writeRegistryYaml } from './helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../src/cli.ts');

test('validate exits 0 for a valid object registry yaml', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistryYaml());

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'validate', '-f', workspace.yamlPath],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid object registry:/);
  assert.match(result.stdout, /index\.yaml/);
  assert.equal(result.stderr, '');
});

test('validate exits 1 for an invalid object registry yaml without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, `
objects:
  bad:
    names: []
    category: camera
    summary: bad
    visual_traits: []
    usage_profiles: {}
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

test('list-all and search output object summaries', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistryYaml());

  for (const args of [
    ['list-all', '-f', workspace.yamlPath],
    ['search', '-f', workspace.yamlPath, 'rangefinder'],
  ]) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', cliPath, ...args],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /id: vintage_rangefinder/);
    assert.match(result.stdout, /- Vintage 35mm rangefinder/);
    assert.match(result.stdout, /category: camera/);
    assert.match(result.stdout, /subtype: 35mm rangefinder/);
    assert.match(result.stdout, /summary: Compact vintage-style 35mm rangefinder camera\./);
    assert.match(result.stdout, /- carrying/);
    assert.equal(result.stderr, '');
  }
});

test('get-object-info outputs prompt-building data', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistryYaml());

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'get-object-info', '-f', workspace.yamlPath, 'vintage_rangefinder'],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /visual_traits:/);
  assert.match(result.stdout, /accessories:/);
  assert.match(result.stdout, /usage_profiles:/);
  assert.match(result.stdout, /constraints:/);
  assert.match(result.stdout, /reference_images:/);
  assert.match(result.stdout, /resolved_path:/);
  assert.equal(result.stderr, '');
});

test('get-reference-path outputs a resolved reference path', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistryYaml());

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'get-reference-path', '-f', workspace.yamlPath, 'vintage_rangefinder', 'front_angle'],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), workspace.pngPath);
  assert.equal(result.stderr, '');
});

test('get-object commands report missing objects without a stack trace', async (t) => {
  const workspace = await createFileTestWorkspace(t);
  await writeRegistryYaml(workspace, validRegistryYaml());

  for (const args of [
    ['get-object-info', '-f', workspace.yamlPath, 'missing'],
    ['get-reference-path', '-f', workspace.yamlPath, 'vintage_rangefinder', 'missing'],
  ]) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', cliPath, ...args],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error:/);
    assert.doesNotMatch(result.stderr, /at Command\./);
  }
});

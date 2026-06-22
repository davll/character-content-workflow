import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildMetadata } from '../src/metadata.ts';
import { runGenerateImage } from '../src/runner.ts';

const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('runGenerateImage does not write metadata when metadata path is omitted', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-metadata-'));
  const outputPath = path.join(tmpRoot, 'out.png');

  const result = await runGenerateImage({
    provider: 'openai',
    outputPath,
    promptText: 'A tiny blue square.',
    dryRun: true,
  });

  assert.equal(result.status, 'skipped');
  assert.deepEqual(await fs.readdir(tmpRoot), []);
});

test('runGenerateImage ignores sibling json when metadata path is omitted', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-metadata-'));
  const outputPath = path.join(tmpRoot, 'out.png');
  const siblingJsonPath = path.join(tmpRoot, 'out.json');
  const existingJson = '{"existing":true}\n';
  await fs.writeFile(siblingJsonPath, existingJson, 'utf-8');

  const result = await runGenerateImage({
    provider: 'openai',
    outputPath,
    promptText: 'A tiny blue square.',
    dryRun: true,
  });

  assert.equal(result.status, 'skipped');
  assert.match(result.message, /Dry run: image generation skipped/);
  assert.equal(await fs.readFile(siblingJsonPath, 'utf-8'), existingJson);
});

test('runGenerateImage writes blocked dry-run metadata with original reference paths', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-metadata-'));
  const outputPath = path.join(tmpRoot, 'out.png');
  const metadataPath = path.join(tmpRoot, 'metadata', 'metadata.json');
  const referenceA = path.join(tmpRoot, 'ref-a.png');
  const referenceB = path.join(tmpRoot, 'nested', 'ref-b.png');
  await fs.mkdir(path.dirname(referenceB), { recursive: true });
  await fs.writeFile(referenceA, pngData);
  await fs.writeFile(referenceB, pngData);

  await runGenerateImage({
    provider: 'OpenAI',
    outputPath,
    metadataPath,
    promptText: 'A tiny blue square.',
    referenceImagePaths: [referenceA, referenceB],
    dryRun: true,
    size: '1024x1024',
    quality: 'high',
    moderation: 'low',
  });

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  assert.equal(metadata.prompt, 'A tiny blue square.');
  assert.deepEqual(metadata.references, [referenceA, referenceB]);
  assert.equal(metadata.provider, 'openai');
  assert.equal(metadata.model, 'gpt-image-2');
  assert.equal(metadata.status, 'blocked');
  assert.equal(metadata.options.size, '1024x1024');
  assert.equal(metadata.options.quality, 'high');
  assert.equal(metadata.options.moderation, 'low');
  assert.equal(metadata.options.dryRun, true);
  assert.equal(metadata.options.force, false);
  assert.deepEqual(metadata.outputPaths, [outputPath]);
  assert.equal(metadata.usage, null);
  assert.equal(metadata.error, null);
});

test('runGenerateImage does not overwrite existing metadata without force', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-metadata-'));
  const outputPath = path.join(tmpRoot, 'out.png');
  const metadataPath = path.join(tmpRoot, 'metadata.json');
  const existingMetadata = '{"existing":true}\n';
  await fs.writeFile(metadataPath, existingMetadata, 'utf-8');

  const result = await runGenerateImage({
    provider: 'openai',
    outputPath,
    metadataPath,
    promptText: 'A tiny blue square.',
    dryRun: true,
  });

  assert.equal(result.status, 'skipped');
  assert.match(result.message, /metadata\.json already exists/);
  assert.equal(await fs.readFile(metadataPath, 'utf-8'), existingMetadata);
});

test('runGenerateImage overwrites existing metadata with force', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-metadata-'));
  const outputPath = path.join(tmpRoot, 'out.png');
  const metadataPath = path.join(tmpRoot, 'metadata.json');
  await fs.writeFile(metadataPath, '{"existing":true}\n', 'utf-8');

  const result = await runGenerateImage({
    provider: 'openai',
    outputPath,
    metadataPath,
    promptText: 'A tiny blue square.',
    dryRun: true,
    force: true,
  });

  assert.equal(result.status, 'skipped');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  assert.equal(metadata.prompt, 'A tiny blue square.');
  assert.equal(metadata.status, 'blocked');
  assert.equal(metadata.options.force, true);
});

test('runGenerateImage writes failed metadata when validation fails after prompt resolution', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-metadata-'));
  const metadataPath = path.join(tmpRoot, 'metadata.json');

  await assert.rejects(
    () => runGenerateImage({
      provider: 'unknown',
      outputPath: path.join(tmpRoot, 'out.png'),
      metadataPath,
      promptText: 'A tiny blue square.',
    }),
    /Unsupported provider: unknown/,
  );

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  assert.equal(metadata.prompt, 'A tiny blue square.');
  assert.deepEqual(metadata.references, []);
  assert.equal(metadata.provider, 'unknown');
  assert.equal(metadata.model, null);
  assert.equal(metadata.status, 'failed');
  assert.equal(metadata.usage, null);
  assert.equal(metadata.error, 'Unsupported provider: unknown');
});

test('buildMetadata preserves usage and reference argument order', () => {
  const metadata = buildMetadata(
    {
      provider: 'openai',
      model: 'gpt-image-2',
      outputPath: 'out.png',
      promptText: 'prompt',
      referenceImagePaths: ['z.png', 'a.png'],
    },
    {
      prompt: 'prompt',
      provider: 'openai',
      model: 'gpt-image-2',
    },
    'success',
    ['out.png'],
    {
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
    },
    null,
  );

  assert.deepEqual(metadata.references, ['z.png', 'a.png']);
  assert.deepEqual(metadata.usage, {
    inputTokens: 120,
    outputTokens: 80,
    totalTokens: 200,
  });
});

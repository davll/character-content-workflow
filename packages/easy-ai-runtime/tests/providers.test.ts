import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImage, listImageModels } from '../src/image.ts';
import { generateText } from '../src/text.ts';

test('generateImage rejects unsupported providers', async () => {
  await assert.rejects(
    () => generateImage(
      { name: 'unknown', apiKey: 'unused' },
      { model: 'model', prompt: 'prompt', images: [], options: {} },
    ),
    /Unsupported provider: unknown/,
  );
});

test('listImageModels rejects unsupported providers', async () => {
  await assert.rejects(
    () => listImageModels({ name: 'unknown', apiKey: 'unused' }),
    /Unsupported provider: unknown/,
  );
});

test('generateText rejects unsupported providers', async () => {
  await assert.rejects(
    () => generateText(
      { name: 'unknown', apiKey: 'unused' },
      {
        model: 'model',
        instructions: 'instructions',
        input: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      },
    ),
    /Unsupported provider: unknown/,
  );
});

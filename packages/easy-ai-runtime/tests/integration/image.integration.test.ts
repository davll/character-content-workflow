import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import {
  generateImage,
  listImageModels,
} from '../../src/index.ts';
import { createProvider, getProviderSkipReason } from './helpers.ts';

interface ImageIntegrationOptions {
  enableImageGeneration: boolean;
  openaiApiKeyEnv: string;
  openaiImageModel: string;
  xaiApiKeyEnv: string;
  xaiImageModel: string;
  clean: boolean;
}

const integrationOptions = parseImageIntegrationOptions(process.argv);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const referenceImagePath = path.join(testRoot, 'yokoyama.png');
const tmpRoot = path.join(testRoot, 'tmp/image-generation');

if (integrationOptions.clean) {
  await fs.rm(tmpRoot, { recursive: true, force: true });
}

describe('easy-ai-runtime image API integration', () => {
  for (const provider of [
    {
      providerName: 'openai',
      apiKey: process.env[integrationOptions.openaiApiKeyEnv],
      imageModel: integrationOptions.openaiImageModel,
      modelPattern: /^gpt-image-/,
      expectUsage: true,
    },
    {
      providerName: 'xai',
      apiKey: process.env[integrationOptions.xaiApiKeyEnv],
      imageModel: integrationOptions.xaiImageModel,
      modelPattern: /^grok-imagine-image-/,
      expectUsage: false,
    },
  ]) {
    generateImageTestCases(
      provider.providerName,
      provider.apiKey,
      provider.imageModel,
      provider.modelPattern,
      provider.expectUsage,
      integrationOptions.enableImageGeneration,
    );
  }
});

function generateImageTestCases(
  providerName: string,
  apiKey: string | undefined,
  imageModel: string,
  modelPattern: RegExp,
  expectUsage: boolean,
  enableImageGeneration: boolean,
): void {
  const skip = getProviderSkipReason(providerName, apiKey);

  test(
    `${providerName} listImageModels returns image models`,
    { skip, timeout: 60_000 },
    async () => {
      const models = await listImageModels(createProvider(providerName, apiKey));
      assert.ok(models.length > 0, `Expected at least one ${providerName} image model.`);
      assert.ok(models.every((model) => modelPattern.test(model)));
    },
  );

  test(
    `${providerName} generateImage maps prompt-only request to generated image data`,
    { skip: skip || getImageGenerationSkipReason(enableImageGeneration), timeout: 180_000 },
    async () => {
      const response = await generateImage(createProvider(providerName, apiKey), {
        model: imageModel,
        prompt: [
          'Create a tiny original integration-test image.',
          'Flat vector style.',
          'A red square centered on a white background.',
          'No text, no watermark, no logo.',
        ].join(' '),
        images: [],
        options: {
          count: 1,
          size: '1024x1024',
          quality: 'low',
          aspectRatio: '1:1',
          resolution: '1k',
        },
      });

      await assertGeneratedImageResponse(providerName, imageModel, 'text-to-image', response, expectUsage);
    },
  );

  test(
    `${providerName} generateImage maps reference image request to generated image data`,
    { skip: skip || getImageGenerationSkipReason(enableImageGeneration), timeout: 180_000 },
    async () => {
      const response = await generateImage(createProvider(providerName, apiKey), {
        model: imageModel,
        prompt: [
          'Use the supplied reference image as the visual source.',
          'Create a new image that preserves the main subject but changes the pose to both arms crossed over the chest.',
          'Render it as a clean watercolor illustration.',
          'Keep the composition simple.',
          'No text, no watermark, no logo.',
        ].join(' '),
        images: [{
          data: await fs.readFile(referenceImagePath),
          mimeType: 'image/png',
          name: 'yokoyama.png',
        }],
        options: {
          count: 1,
          size: '1024x1024',
          quality: 'low',
          aspectRatio: '1:1',
          resolution: '1k',
        },
      });

      await assertGeneratedImageResponse(providerName, imageModel, 'image-to-image', response, expectUsage);
    },
  );
}

async function assertGeneratedImageResponse(
  providerName: string,
  imageModel: string,
  scenario: string,
  response: Awaited<ReturnType<typeof generateImage>>,
  expectUsage: boolean,
): Promise<void> {
  assert.equal(response.images.length, 1);
  assert.ok(['png', 'jpeg', 'webp'].includes(response.images[0].format));
  assert.ok(response.images[0].data.length > 1000);
  const outputPaths = await writeGeneratedImages(providerName, imageModel, scenario, response.images);
  assert.equal(outputPaths.length, response.images.length);
  if (expectUsage) {
    assert.ok(response.usage?.inputTokens, 'Expected positive input token usage.');
    assert.ok(response.usage?.outputTokens, 'Expected positive output token usage.');
    assert.ok(response.usage?.totalTokens, 'Expected positive total token usage.');
    assert.ok(response.usage.totalTokens >= response.usage.inputTokens);
    assert.ok(response.usage.totalTokens >= response.usage.outputTokens);
  }
}

async function writeGeneratedImages(
  providerName: string,
  imageModel: string,
  scenario: string,
  images: Array<{ data: Buffer; format: string }>,
): Promise<string[]> {
  await fs.mkdir(tmpRoot, { recursive: true });
  const safeModel = imageModel.replace(/[^a-z0-9._-]+/gi, '-');
  const runId = `${providerName}-${safeModel}-${scenario}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const outputPaths: string[] = [];

  for (const [index, image] of images.entries()) {
    const outputPath = path.join(tmpRoot, `${runId}-${index + 1}.${image.format}`);
    await fs.writeFile(outputPath, image.data);
    outputPaths.push(outputPath);
  }

  console.log(`Saved generated ${providerName} image integration outputs: ${outputPaths.join(', ')}`);
  return outputPaths;
}

function getImageGenerationSkipReason(enableImageGeneration: boolean): false | string {
  return enableImageGeneration ? false : '--enable-image-generation not set';
}

function parseImageIntegrationOptions(argv: string[]): ImageIntegrationOptions {
  const program = new Command()
    .option('--openai-api-key-env <name>', 'Environment variable name that contains the OpenAI API key', 'OPENAI_API_KEY')
    .option('--enable-image-generation', 'Run image generation integration tests that may incur higher cost', false)
    .option('--openai-image-model <model>', 'OpenAI image model for image generation integration tests', 'gpt-image-2')
    .option('--xai-api-key-env <name>', 'Environment variable name that contains the xAI API key', 'XAI_API_KEY')
    .option('--xai-image-model <model>', 'xAI image model for image generation integration tests', 'grok-imagine-image-quality')
    .option('--clean', 'Remove old image integration test outputs before running', false);

  program.parse(argv, { from: 'node' });
  const options = program.opts<ImageIntegrationOptions>();
  options.enableImageGeneration = Boolean(options.enableImageGeneration);
  options.clean = Boolean(options.clean);
  return options;
}

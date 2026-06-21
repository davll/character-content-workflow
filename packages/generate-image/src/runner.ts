import { generateImage, type GenerateImageRequest, type ReferenceImage } from '@davll/easy-ai-runtime';
import { loadReferenceImages, resolvePrompt } from './files.ts';
import { createLogger } from './logger.ts';
import {
  buildDryRunResult,
  checkRequestedOutputConflicts,
  ensureOutputDir,
  saveGeneratedImages,
} from './outputs.ts';
import { assertSupportedProvider, getProvider, resolveModel } from './providers.ts';
import type { GenerateImageOptions, GenerateImageResult } from './types.ts';

export async function runGenerateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const log = createLogger(options.verbose);
  validateGenerationOptions(options);

  const prompt = await resolvePrompt(options, log);
  const provider = options.provider.toLowerCase();
  assertSupportedProvider(provider);
  const model = resolveModel(provider, options.model);

  await ensureOutputDir(options.outputPath, log);
  const skipped = checkRequestedOutputConflicts(options, log);
  if (skipped) {
    return skipped;
  }

  const images = await loadReferenceImages(options.referenceImagePaths);
  const generationRequest = buildGenerationRequest(model, prompt, images, options);
  if (options.dryRun) {
    log('Dry run: skipping provider setup and image generation.');
    return buildDryRunResult(options.outputPath, options.count);
  }

  const providerHandle = getProvider(provider, options.apiKey, options.verbose);

  log(`Invoking ${provider} provider...`);
  const result = await generateImage(providerHandle, generationRequest);

  log(`Received ${result.images.length} image(s) from ${provider}`);
  return await saveGeneratedImages(result.images, options.outputPath, options.force, log);
}

function validateGenerationOptions(options: GenerateImageOptions): void {
  if (!options.outputPath?.trim()) {
    throw new Error('Output path is required.');
  }
  if (options.count !== undefined && (!Number.isInteger(options.count) || options.count < 1)) {
    throw new Error('Image count must be a positive integer.');
  }
}

function buildGenerationRequest(
  model: string,
  prompt: string,
  images: ReferenceImage[],
  options: GenerateImageOptions,
): GenerateImageRequest {
  return {
    model,
    prompt,
    images,
    options: {
      count: options.count,
      size: options.size,
      quality: options.quality,
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
      moderation: options.moderation,
    },
  };
}

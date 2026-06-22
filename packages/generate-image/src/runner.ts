import { generateImage, type GenerateImageRequest, type ReferenceImage } from '@davll/easy-ai-runtime';
import { loadReferenceImages, resolvePrompt } from './files.ts';
import { createLogger } from './logger.ts';
import { getMetadataStatus, type MetadataContext, writeMetadata } from './metadata.ts';
import {
  buildDryRunResult,
  checkMetadataOutputConflict,
  checkRequestedOutputConflicts,
  ensureOutputDir,
  getOutputPaths,
  saveGeneratedImages,
} from './outputs.ts';
import { assertSupportedProvider, getProvider, resolveModel } from './providers.ts';
import type { GenerateImageOptions, GenerateImageResult } from './types.ts';

export async function runGenerateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const log = createLogger(options.verbose);
  const metadataContext: MetadataContext = {};

  try {
    validateGenerationOptions(options);

    const prompt = await resolvePrompt(options, log);
    metadataContext.prompt = prompt;
    const provider = options.provider.toLowerCase();
    metadataContext.provider = provider;
    assertSupportedProvider(provider);
    const model = resolveModel(provider, options.model);
    metadataContext.model = model;

    await ensureOutputDir(options.outputPath, log);
    const skipped = checkRequestedOutputConflicts(options, log);
    if (skipped) {
      await writeMetadata(
        options.metadataPath,
        options,
        metadataContext,
        getMetadataStatus(skipped),
        skipped.outputPaths,
        skipped.usage,
        null,
      );
      return skipped;
    }
    const metadataSkipped = checkMetadataOutputConflict(
      options,
      getOutputPaths(options.outputPath, options.count && options.count > 1 ? options.count : 1),
      log,
    );
    if (metadataSkipped) {
      return metadataSkipped;
    }

    const images = await loadReferenceImages(options.referenceImagePaths);
    const generationRequest = buildGenerationRequest(model, prompt, images, options);
    if (options.dryRun) {
      log('Dry run: skipping provider setup and image generation.');
      const result = buildDryRunResult(options.outputPath, options.count);
      await writeMetadata(
        options.metadataPath,
        options,
        metadataContext,
        getMetadataStatus(result),
        result.outputPaths,
        result.usage,
        null,
      );
      return result;
    }

    const providerHandle = getProvider(provider, options.apiKey, options.verbose);

    log(`Invoking ${provider} provider...`);
    const result = await generateImage(providerHandle, generationRequest);

    log(`Received ${result.images.length} image(s) from ${provider}`);
    const saveResult = await saveGeneratedImages(result.images, options.outputPath, options.force, log);
    saveResult.usage = result.usage;
    await writeMetadata(
      options.metadataPath,
      options,
      metadataContext,
      getMetadataStatus(saveResult),
      saveResult.outputPaths,
      saveResult.usage,
      null,
    );
    return saveResult;
  } catch (error) {
    try {
      await writeMetadata(
        options.metadataPath,
        options,
        metadataContext,
        'failed',
        [],
        undefined,
        error,
      );
    } catch {
      // Preserve the original generation error; metadata is best-effort on failure paths.
    }
    throw error;
  }
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

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { GeneratedImage } from '@davll/easy-ai-runtime';
import type { GenerateImageOptions, GenerateImageResult, Logger } from './types.ts';

export function getOutputPaths(outputPath: string, count: number): string[] {
  if (count === 1) {
    return [outputPath];
  }

  const ext = path.extname(outputPath);
  const base = ext ? outputPath.slice(0, -ext.length) : outputPath;
  return Array.from({ length: count }, (_, i) => (i === 0 ? outputPath : `${base}_${i}${ext}`));
}

export async function ensureOutputDir(outputPath: string, log: Logger): Promise<void> {
  const dir = path.dirname(outputPath);
  log(`Ensuring output directory exists: ${dir}`);
  await fs.mkdir(dir, { recursive: true });
}

export function buildDryRunResult(outputPath: string, count?: number): GenerateImageResult {
  const outputPaths = getOutputPaths(outputPath, count && count > 1 ? count : 1);
  return {
    status: 'skipped',
    message: outputPaths.length === 1
      ? `Dry run: image generation skipped. Requested output: ${outputPaths[0]}`
      : `Dry run: image generation skipped. Requested outputs:\n${outputPaths.map((p) => ` - ${p}`).join('\n')}`,
    outputPaths,
  };
}

export function checkRequestedOutputConflicts(
  options: GenerateImageOptions,
  log: Logger,
): GenerateImageResult | undefined {
  const requestedOutputPaths = getOutputPaths(options.outputPath, options.count && options.count > 1 ? options.count : 1);
  const existingPath = findOutputConflict(requestedOutputPaths, options.force);
  if (!existingPath) {
    return undefined;
  }

  log(`Output file already exists: ${existingPath}`);
  return buildSkippedResult(existingPath, requestedOutputPaths);
}

export async function saveGeneratedImages(
  images: GeneratedImage[],
  outputPath: string,
  force: boolean | undefined,
  log: Logger,
): Promise<GenerateImageResult> {
  if (images.length === 0) {
    throw new Error('Image provider returned no images.');
  }

  const outputPaths = getOutputPaths(outputPath, images.length);
  const existingPath = findOutputConflict(outputPaths, force);
  if (existingPath) {
    log(`Output file already exists: ${existingPath}`);
    return buildSkippedResult(existingPath, outputPaths);
  }

  if (images.length === 1) {
    log(`Saving image to: ${outputPaths[0]}`);
    await fs.writeFile(outputPaths[0], images[0].data);
    return {
      status: 'generated',
      message: `Image successfully generated and saved to: ${outputPaths[0]}`,
      outputPaths,
    };
  }

  for (let i = 0; i < images.length; i++) {
    const targetPath = outputPaths[i];
    log(`Saving image ${i + 1}/${images.length} to: ${targetPath}`);
    await fs.writeFile(targetPath, images[i].data);
  }

  return {
    status: 'generated',
    message: `Multiple images (${images.length}) successfully generated and saved to:\n${outputPaths.map((p) => ` - ${p}`).join('\n')}`,
    outputPaths,
  };
}

function buildSkippedResult(existingPath: string, outputPaths: string[]): GenerateImageResult {
  return {
    status: 'skipped',
    message: `File ${path.basename(existingPath)} already exists. Skipping generation.`,
    outputPaths,
  };
}

function findOutputConflict(outputPaths: string[], force?: boolean): string | undefined {
  if (force) {
    return undefined;
  }

  return outputPaths.find((outputPath) => existsSync(outputPath));
}

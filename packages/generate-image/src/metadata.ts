import fs from 'node:fs/promises';
import path from 'node:path';
import type { GenerateImageUsage } from '@davll/easy-ai-runtime';
import type { GenerateImageOptions, GenerateImageResult } from './types.ts';

export type MetadataStatus = 'success' | 'blocked' | 'failed';

export interface GenerateImageMetadata {
  prompt: string | null;
  references: string[];
  provider: string | null;
  model: string | null;
  options: {
    count: number | null;
    size: string | null;
    quality: string | null;
    aspectRatio: string | null;
    resolution: string | null;
    moderation: string | null;
    dryRun: boolean;
    force: boolean;
  };
  status: MetadataStatus;
  outputPaths: string[];
  usage: GenerateImageUsage | null;
  error: string | null;
}

export interface MetadataContext {
  prompt?: string;
  provider?: string;
  model?: string;
}

export async function writeMetadata(
  metadataPath: string | undefined,
  options: GenerateImageOptions,
  context: MetadataContext,
  status: MetadataStatus,
  outputPaths: string[],
  usage: GenerateImageUsage | undefined,
  error: unknown,
): Promise<void> {
  if (!metadataPath) {
    return;
  }

  const metadata = buildMetadata(options, context, status, outputPaths, usage, error);
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
}

export function buildMetadata(
  options: GenerateImageOptions,
  context: MetadataContext,
  status: MetadataStatus,
  outputPaths: string[],
  usage: GenerateImageUsage | undefined,
  error: unknown,
): GenerateImageMetadata {
  return {
    prompt: context.prompt ?? null,
    references: options.referenceImagePaths ?? [],
    provider: context.provider ?? null,
    model: context.model ?? null,
    options: {
      count: options.count ?? null,
      size: options.size ?? null,
      quality: options.quality ?? null,
      aspectRatio: options.aspectRatio ?? null,
      resolution: options.resolution ?? null,
      moderation: options.moderation ?? null,
      dryRun: options.dryRun ?? false,
      force: options.force ?? false,
    },
    status,
    outputPaths,
    usage: usage ?? null,
    error: error ? getErrorMessage(error) : null,
  };
}

export function getMetadataStatus(result: GenerateImageResult): MetadataStatus {
  return result.status === 'generated' ? 'success' : 'blocked';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

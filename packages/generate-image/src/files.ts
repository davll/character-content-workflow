import fs from 'node:fs/promises';
import path from 'node:path';
import type { ReferenceImage } from '@davll/easy-ai-runtime';
import type { GenerateImageOptions, Logger } from './types.ts';

export async function loadReferenceImages(referenceImagePaths: string[] | undefined): Promise<ReferenceImage[]> {
  if (!referenceImagePaths || referenceImagePaths.length === 0) {
    return [];
  }

  const references: ReferenceImage[] = [];
  for (const imagePath of referenceImagePaths) {
    const data = await fs.readFile(imagePath);
    const mimeType = sniffImageMimeType(data);
    if (!mimeType) {
      throw new Error(`Unsupported reference image format: ${imagePath}. Only JPEG and PNG are supported.`);
    }
    references.push({
      name: path.basename(imagePath),
      data,
      mimeType,
    });
  }

  return references;
}

export async function resolvePrompt(options: GenerateImageOptions, log: Logger): Promise<string> {
  if (options.promptText !== undefined) {
    const prompt = options.promptText.trim();
    if (prompt) {
      log(`Using inline prompt text: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
      return prompt;
    }
  }

  if (options.promptFilePath) {
    const prompt = (await fs.readFile(options.promptFilePath, 'utf-8')).trim();
    if (!prompt) {
      throw new Error(`Prompt file is empty: ${options.promptFilePath}`);
    }
    log(`Read prompt from file: ${options.promptFilePath}`);
    return prompt;
  }

  throw new Error('Either promptText or promptFilePath must be provided.');
}

function sniffImageMimeType(data: Buffer): string | null {
  if (data.length < 4) return null;

  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png';
  }

  return null;
}

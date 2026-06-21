import type { Provider } from './types.ts';

export interface ReferenceImage {
  data: Buffer;
  mimeType: string;
  name?: string;
}

export interface GeneratedImage {
  data: Buffer;
  format: string;
}

export interface GenerateImageUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface GenerateImageResponse {
  images: GeneratedImage[];
  usage?: GenerateImageUsage;
}

export interface GenerateImageRequest {
  model: string;
  prompt: string;
  images: ReferenceImage[];
  options: {
    count?: number;
    size?: string;
    quality?: string;
    moderation?: string;
    aspectRatio?: string;
    resolution?: string;
  };
}

export async function generateImage(
  provider: Provider,
  request: GenerateImageRequest,
): Promise<GenerateImageResponse> {
  switch (provider.name.toLowerCase()) {
    case 'openai': {
      const { generateImageOpenAI } = await import('./openai/image.ts');
      return generateImageOpenAI(provider, request);
    }
    case 'xai': {
      const { generateImageXAI } = await import('./xai/image.ts');
      return generateImageXAI(provider, request);
    }
    default:
      throw new Error(`Unsupported provider: ${provider.name}`);
  }
}

export async function listImageModels(provider: Provider): Promise<string[]> {
  switch (provider.name.toLowerCase()) {
    case 'openai': {
      const { listImageModelsOpenAI } = await import('./openai/image.ts');
      return listImageModelsOpenAI(provider);
    }
    case 'xai': {
      const { listImageModelsXAI } = await import('./xai/image.ts');
      return listImageModelsXAI(provider);
    }
    default:
      throw new Error(`Unsupported provider: ${provider.name}`);
  }
}

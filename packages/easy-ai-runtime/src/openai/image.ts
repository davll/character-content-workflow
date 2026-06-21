import type { Provider } from '../types.ts';
import type { GenerateImageRequest, GenerateImageResponse, GenerateImageUsage } from '../image.ts';
import { openAIJsonRequest, openAIMultipartRequest } from './rest.ts';

const MODEL_FILTER = /^gpt-image-/;

interface OpenAIModelListResponse {
  data?: Array<{ id?: string }>;
}

export interface OpenAIImagesResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export async function listImageModelsOpenAI(provider: Provider): Promise<string[]> {
  const response = await openAIJsonRequest<OpenAIModelListResponse>(provider, '/models');
  return (response.data ?? [])
    .map((model) => model.id ?? '')
    .filter((id) => MODEL_FILTER.test(id))
    .sort();
}

export async function generateImageOpenAI(
  provider: Provider,
  request: GenerateImageRequest,
): Promise<GenerateImageResponse> {
  const baseParams = {
    model: request.model,
    prompt: request.prompt,
    n: request.options.count || 1,
    size: request.options.size || 'auto',
    quality: (request.options.quality as any) || 'auto',
    moderation: (request.options.moderation as any) || 'auto',
  };

  let response: OpenAIImagesResponse;

  if (request.images.length > 0) {
    response = await openAIMultipartRequest<OpenAIImagesResponse>(
      provider,
      '/images/edits',
      buildImageEditFormData(baseParams, request.images),
    );
  } else {
    response = await openAIJsonRequest<OpenAIImagesResponse>(provider, '/images/generations', {
      ...baseParams,
      stream: false,
    });
  }

  return buildGenerateImageResponse(response);
}

export function buildGenerateImageResponse(
  response: OpenAIImagesResponse,
  apiName = 'OpenAI',
): GenerateImageResponse {
  if (!response.data || response.data.length === 0) {
    throw new Error(`${apiName} API returned no data: ${JSON.stringify(response)}`);
  }

  const images = response.data.map((item, index) => {
    if (item.b64_json) {
      const data = Buffer.from(item.b64_json, 'base64');
      return {
        data,
        format: detectImageFormat(data),
      };
    }
    throw new Error(`${apiName} API returned no b64_json data at index ${index}: ${JSON.stringify(response)}`);
  });
  const usage = mapOpenAIImagesUsageToGenerateImageUsage(response);

  return {
    images,
    ...(usage ? { usage } : {}),
  };
}

function mapOpenAIImagesUsageToGenerateImageUsage(
  response: OpenAIImagesResponse,
): GenerateImageUsage | undefined {
  const usage = response.usage;
  if (!usage) {
    return undefined;
  }

  const result: GenerateImageUsage = {
    ...(typeof usage.input_tokens === 'number' ? { inputTokens: usage.input_tokens } : {}),
    ...(typeof usage.output_tokens === 'number' ? { outputTokens: usage.output_tokens } : {}),
    ...(typeof usage.total_tokens === 'number' ? { totalTokens: usage.total_tokens } : {}),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}

export function buildImageEditFormData(
  params: Record<string, string | number | boolean>,
  images: GenerateImageRequest['images'],
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }
  formData.append('stream', 'false');

  for (const image of images) {
    formData.append('image[]', new Blob([bufferToArrayBuffer(image.data)], { type: image.mimeType }), image.name ?? 'reference-image');
  }

  return formData;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function detectImageFormat(data: Buffer): string {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'jpeg';
  }
  if (
    data.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) &&
    data.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'))
  ) {
    return 'webp';
  }
  return 'unknown';
}

import type { Provider } from '../types.ts';
import type { GenerateImageRequest, GenerateImageResponse } from '../image.ts';
import { buildGenerateImageResponse, type OpenAIImagesResponse } from '../openai/image.ts';
import { openAIJsonRequest } from '../openai/rest.ts';

const XAI_BASE_URL = 'https://api.x.ai/v1';
const XAI_IMAGE_MODEL_FILTER = /^grok-imagine-image-/;
const MAX_EDIT_IMAGES = 3;

interface XAIModelListResponse {
  data?: Array<{ id?: string }>;
}

interface XAIImageReference {
  type: 'image_url';
  url: string;
}

export async function listImageModelsXAI(provider: Provider): Promise<string[]> {
  const response = await openAIJsonRequest<XAIModelListResponse>(provider, '/models', undefined, {
    baseUrl: XAI_BASE_URL,
    apiName: 'xAI',
  });
  return (response.data ?? [])
    .map((model) => model.id ?? '')
    .filter((id) => XAI_IMAGE_MODEL_FILTER.test(id))
    .sort();
}

export async function generateImageXAI(
  provider: Provider,
  request: GenerateImageRequest,
): Promise<GenerateImageResponse> {
  const response = request.images.length > 0
    ? await openAIJsonRequest<OpenAIImagesResponse>(
      provider,
      '/images/edits',
      buildXAIImageEditBody(request),
      { baseUrl: XAI_BASE_URL, apiName: 'xAI' },
    )
    : await openAIJsonRequest<OpenAIImagesResponse>(
      provider,
      '/images/generations',
      buildXAIImageGenerationBody(request),
      { baseUrl: XAI_BASE_URL, apiName: 'xAI' },
    );

  return buildGenerateImageResponse(response, 'xAI');
}

export function buildXAIImageGenerationBody(request: GenerateImageRequest): Record<string, unknown> {
  return {
    model: request.model,
    prompt: request.prompt,
    n: request.options.count || 1,
    response_format: 'b64_json',
    ...(request.options.aspectRatio ? { aspect_ratio: request.options.aspectRatio } : {}),
    ...(request.options.resolution ? { resolution: request.options.resolution } : {}),
  };
}

export function buildXAIImageEditBody(request: GenerateImageRequest): Record<string, unknown> {
  if (request.images.length > MAX_EDIT_IMAGES) {
    throw new Error(`xAI image editing supports at most ${MAX_EDIT_IMAGES} reference images.`);
  }

  const references = request.images.map((image): XAIImageReference => ({
    type: 'image_url',
    url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
  }));

  return {
    ...buildXAIImageGenerationBody(request),
    ...(references.length === 1 ? { image: references[0] } : { images: references }),
  };
}

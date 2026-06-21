import type { ZodType } from 'zod';
import type { Provider } from '../types.ts';
import type { GenerateTextRequest, GenerateTextResponse } from '../text.ts';
import { generateTextOpenAI } from '../openai/text.ts';

const XAI_BASE_URL = 'https://api.x.ai/v1';

export async function generateTextXAI<TSchema extends ZodType | undefined = undefined>(
  provider: Provider,
  request: GenerateTextRequest<TSchema>,
): Promise<GenerateTextResponse> {
  return generateTextOpenAI(provider, request, {
    baseUrl: XAI_BASE_URL,
    apiName: 'xAI',
  });
}

import { listImageModels, type Provider } from '@davll/easy-ai-runtime';
import { createLogger } from './logger.ts';

type ImageProvider = 'openai' | 'xai';

const DEFAULT_MODELS: Record<ImageProvider, string> = {
  openai: 'gpt-image-2',
  xai: 'grok-imagine-image-quality',
};

const DEFAULT_API_KEY_ENVS: Record<ImageProvider, string> = {
  openai: 'OPENAI_API_KEY',
  xai: 'XAI_API_KEY',
};

export function getProvider(provider: string, apiKey: string | undefined, verbose?: boolean): Provider {
  const normalized = provider.toLowerCase();
  const log = createLogger(verbose);

  log('Loading provider with explicit API key');
  assertSupportedProvider(normalized);
  if (!apiKey) {
    throw new Error(`${normalized} API key is required.`);
  }
  return { name: normalized, apiKey };
}

export async function listModels(provider: string, apiKey: string | undefined, verbose?: boolean): Promise<string[]> {
  const log = createLogger(verbose);
  const normalized = provider.toLowerCase();
  assertSupportedProvider(normalized);
  log(`Listing models for ${normalized}...`);
  const providerHandle = getProvider(provider, apiKey, verbose);
  const models = await listImageModels(providerHandle);
  return markDefaultModel(models, normalized);
}

export function assertSupportedProvider(provider: string): asserts provider is ImageProvider {
  if (!(provider in DEFAULT_MODELS)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function resolveModel(provider: ImageProvider, model?: string): string {
  assertSupportedProvider(provider);
  const defaultModel = DEFAULT_MODELS[provider];
  return model ?? defaultModel;
}

export function getDefaultApiKeyEnv(provider: string): string {
  const normalized = provider.toLowerCase();
  assertSupportedProvider(normalized);
  return DEFAULT_API_KEY_ENVS[normalized];
}

function markDefaultModel(models: string[], provider: ImageProvider): string[] {
  const defaultModel = resolveModel(provider);
  return models.map((model) => (model === defaultModel ? `${model} (default)` : model));
}

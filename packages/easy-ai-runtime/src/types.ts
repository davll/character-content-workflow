export interface Provider {
  readonly name: string;
  readonly apiKey: string;
}

export type ModelProvider = 'openai' | 'xai';

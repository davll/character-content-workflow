import type { Provider } from '../types.ts';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export interface OpenAICompatibleEndpoint {
  readonly baseUrl?: string;
  readonly apiName?: string;
}

export async function openAIJsonRequest<TResponse>(
  provider: Provider,
  path: string,
  body?: unknown,
  endpoint: OpenAICompatibleEndpoint = {},
): Promise<TResponse> {
  const response = await fetch(`${endpoint.baseUrl ?? OPENAI_BASE_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return readOpenAIResponse<TResponse>(response, endpoint.apiName);
}

export async function openAIMultipartRequest<TResponse>(
  provider: Provider,
  path: string,
  body: FormData,
  endpoint: OpenAICompatibleEndpoint = {},
): Promise<TResponse> {
  const response = await fetch(`${endpoint.baseUrl ?? OPENAI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body,
  });

  return readOpenAIResponse<TResponse>(response, endpoint.apiName);
}

export async function readOpenAIResponse<TResponse>(
  response: Response,
  apiName = 'OpenAI',
): Promise<TResponse> {
  const text = await response.text();
  const parsed = text ? parseJson(text) : undefined;

  if (!response.ok) {
    throw new Error(`${apiName} API request failed: ${response.status} ${formatErrorBody(parsed ?? text)}`);
  }

  return parsed as TResponse;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatErrorBody(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

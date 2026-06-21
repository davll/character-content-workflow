import { z, type ZodType } from 'zod';
import type { Provider } from './types.ts';

export type TextInputContent = TextInputTextContent | TextInputImageContent | TextInputFileContent;

export interface TextInputTextContent {
  type: 'text';
  text: string;
}

export interface TextInputImageContent {
  type: 'image';
  dataUrl?: string;
  url?: string;
  fileId?: string;
  detail?: 'low' | 'high' | 'auto';
}

export interface TextInputFileContent {
  type: 'file';
  fileData?: string;
  fileId?: string;
  fileUrl?: string;
  filename?: string;
}

export type TextMessageContent = TextInputContent;

export interface TextMessage {
  role: 'user' | 'assistant' | 'system';
  content: TextMessageContent[];
}

export interface TextFunctionCallOutput {
  type: 'function_call_output';
  callId: string;
  output: TextFunctionCallOutputValue;
}

export interface TextReasoningInput {
  type: 'reasoning';
  raw: unknown;
}

export type TextInputItem = TextMessage | TextFunctionCallInput | TextFunctionCallOutput | TextReasoningInput;

export type TextInput = TextInputItem[];

export type TextFunctionCallOutputValue = string | TextFunctionCallOutputContent[];

export type TextFunctionCallOutputContent = TextInputContent;
export type TextFunctionCallOutputText = TextInputTextContent;
export type TextFunctionCallOutputImage = TextInputImageContent;
export type TextFunctionCallOutputFile = TextInputFileContent;

export interface TextFunctionTool<TArgs = unknown> {
  type: 'function';
  name: string;
  description: string;
  parameters: ZodType<TArgs>;
  strict?: boolean;
}

export type TextTool<TArgs = unknown> = TextFunctionTool<TArgs>;

export type TextToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string };

export type TextReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface TextReasoningOptions {
  effort?: TextReasoningEffort;
}

export interface TextFunctionCall<TArgs = unknown> {
  id?: string;
  callId: string;
  name: string;
  args: TArgs;
  rawArguments: string;
}

export interface TextFunctionCallInput {
  type: 'function_call';
  func: TextFunctionCall;
}

export type TextOutputItem =
  | { type: 'message'; text: string }
  | { type: 'function_call'; func: TextFunctionCall }
  | { type: 'reasoning'; raw: unknown }
  | { type: 'unknown'; actualType?: string; raw: unknown };

export interface GenerateTextUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface GenerateTextBaseRequest {
  model: string;
  instructions?: string;
  input: TextInput;
}

export interface GenerateTextRequest<TSchema extends ZodType | undefined = undefined> extends GenerateTextBaseRequest {
  schemaName?: string;
  outputSchema?: TSchema;
  tools?: TextTool[];
  toolChoice?: TextToolChoice;
  parallelToolCalls?: boolean;
  reasoning?: TextReasoningOptions;
}

export interface GenerateTextResponse {
  output: TextOutputItem[];
  text?: string;
  structured?: string;
  usage?: GenerateTextUsage;
}

export function parseStructuredTextResult<TSchema extends ZodType>(
  response: GenerateTextResponse,
  outputSchema: TSchema,
): z.infer<TSchema> {
  if (response.structured === undefined) {
    throw new Error('Expected structured text response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.structured);
  } catch (e) {
    throw new Error(`Failed to parse structured response as JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  return outputSchema.parse(parsed);
}

export async function generateText<TSchema extends ZodType | undefined = undefined>(
  provider: Provider,
  request: GenerateTextRequest<TSchema>,
): Promise<GenerateTextResponse> {
  switch (provider.name.toLowerCase()) {
    case 'openai': {
      const { generateTextOpenAI } = await import('./openai/text.ts');
      return generateTextOpenAI(provider, request);
    }
    case 'xai': {
      const { generateTextXAI } = await import('./xai/text.ts');
      return generateTextXAI(provider, request);
    }
    default:
      throw new Error(`Unsupported provider: ${provider.name}`);
  }
}

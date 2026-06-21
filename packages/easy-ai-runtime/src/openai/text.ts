import { z, type ZodType } from 'zod';
import type { Provider } from '../types.ts';
import type {
  GenerateTextBaseRequest,
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateTextUsage,
  TextFunctionCall,
  TextFunctionCallOutputContent,
  TextFunctionCallOutputValue,
  TextInputContent,
  TextInput,
  TextOutputItem,
  TextTool,
  TextToolChoice,
} from '../text.ts';
import { validateStrictJsonSchema } from '../text-schema.ts';
import { openAIJsonRequest, type OpenAICompatibleEndpoint } from './rest.ts';

type OpenAIResponseInput = Array<{
  role: 'user' | 'assistant' | 'system';
  content: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url?: string; file_id?: string; detail?: 'low' | 'high' | 'auto' }
    | { type: 'input_file'; file_data?: string; file_id?: string; file_url?: string; filename?: string }
    | { type: 'output_text'; text: string }
  >;
} | {
  type: 'reasoning';
  [key: string]: unknown;
} | {
  type: 'function_call';
  id?: string;
  call_id: string;
  name: string;
  arguments: string;
} | {
  type: 'function_call_output';
  call_id: string;
  output: OpenAIFunctionCallOutputValue;
}>;

type OpenAIFunctionCallOutputValue = string | OpenAIFunctionCallOutputContent[];

type OpenAIFunctionCallOutputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url?: string; file_id?: string; detail?: 'low' | 'high' | 'auto' }
  | { type: 'input_file'; file_data?: string; file_id?: string; file_url?: string; filename?: string };

interface OpenAIResponsesResponse {
  status?: string;
  error?: { message?: string } | null;
  output_text?: string;
  output?: OpenAIOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

type OpenAIOutputItem =
  | {
      type?: 'message';
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }
  | {
      type?: 'function_call';
      id?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    }
  | {
      type?: string;
      [key: string]: unknown;
    };

interface OpenAIFunctionCallOutputItem {
  type: 'function_call';
  id?: string;
  call_id: string;
  name: string;
  arguments: string;
}

interface OpenAIRequestTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

type OpenAIToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string };

export function parseFunctionCallArguments<TArgs>(
  func: TextFunctionCall,
  parameters: ZodType<TArgs>,
): TArgs {
  return parameters.parse(func.args);
}

export function getOpenAIMessageText(response: any): string | undefined {
  const text = getOpenAIMessageTexts(response).join('');
  return text || undefined;
}

export function getOpenAIMessageTexts(response: any): string[] {
  return (response.output ?? [])
    .filter((item: any) => item.type === 'message')
    .flatMap((item: any) => item.content ?? [])
    .filter((content: any) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content: any) => content.text);
}

export function getOpenAIFunctionCalls(
  response: OpenAIResponsesResponse,
  tools: TextTool[] = [],
): TextFunctionCall[] {
  return (response.output ?? [])
    .filter((item) => item.type === 'function_call')
    .map((item) => mapOpenAIFunctionCall(item, tools));
}

export const getOpenAIFunctionCall = (
  response: OpenAIResponsesResponse,
  tools: TextTool[] = [],
): TextFunctionCall | undefined => getOpenAIFunctionCalls(response, tools)[0];

function mapOpenAIFunctionCall(outputItem: OpenAIOutputItem, tools: TextTool[]): TextFunctionCall {
  if (!isOpenAIFunctionCallOutputItem(outputItem)) {
    throw new Error('Responses API returned an incomplete function_call output item.');
  }

  let parsedArguments: unknown;
  try {
    parsedArguments = JSON.parse(outputItem.arguments);
  } catch (e) {
    throw new Error(`Failed to parse function_call arguments as JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  const tool = tools.find((candidate) => candidate.name === outputItem.name);
  const validatedArguments = tool ? tool.parameters.parse(parsedArguments) : parsedArguments;

  return {
    id: outputItem.id,
    callId: outputItem.call_id,
    name: outputItem.name,
    args: validatedArguments,
    rawArguments: outputItem.arguments,
  };
}

function isOpenAIFunctionCallOutputItem(item: OpenAIOutputItem): item is OpenAIFunctionCallOutputItem {
  return item.type === 'function_call'
    && typeof item.call_id === 'string'
    && typeof item.name === 'string'
    && typeof item.arguments === 'string'
    && (item.id === undefined || typeof item.id === 'string');
}

export function mapTextInputToOpenAI(input: TextInput): OpenAIResponseInput {
  return input.map((item) => {
    if ('raw' in item) {
      if (!isOpenAIReasoningInput(item.raw)) {
        throw new Error('Reasoning input raw item must be an object with type "reasoning".');
      }
      return item.raw;
    }

    if ('func' in item) {
      return {
        type: 'function_call' as const,
        ...(item.func.id ? { id: item.func.id } : {}),
        call_id: item.func.callId,
        name: item.func.name,
        arguments: item.func.rawArguments,
      };
    }

    if ('callId' in item) {
      return {
        type: 'function_call_output' as const,
        call_id: item.callId,
        output: mapTextFunctionCallOutputToOpenAI(item.output),
      };
    }

    return {
      role: item.role,
      content: item.content.map((content) => {
        if (item.role === 'assistant') {
          if (content.type !== 'text') {
            throw new Error('Assistant file and image content is not supported by the OpenAI Responses API.');
          }
          return {
            type: 'output_text' as const,
            text: content.text,
          };
        }

        return mapTextInputContentToOpenAI(content);
      }),
    };
  });
}

export function mapTextFunctionCallOutputToOpenAI(
  output: TextFunctionCallOutputValue,
): OpenAIFunctionCallOutputValue {
  if (typeof output === 'string') {
    return output;
  }
  return output.map(mapTextInputContentToOpenAI);
}

function mapTextInputContentToOpenAI(
  content: TextInputContent | TextFunctionCallOutputContent,
): OpenAIFunctionCallOutputContent {
  if (content.type === 'text') {
    return {
      type: 'input_text',
      text: content.text,
    };
  }

  if (content.type === 'image') {
    const imageUrl = content.dataUrl ?? content.url;
    if (!imageUrl && !content.fileId) {
      throw new Error('Function call output image content requires dataUrl, url, or fileId.');
    }
    return {
      type: 'input_image',
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(content.fileId ? { file_id: content.fileId } : {}),
      detail: content.detail ?? 'auto',
    };
  }

  if (!content.fileData && !content.fileId && !content.fileUrl) {
    throw new Error('Function call output file content requires fileData, fileId, or fileUrl.');
  }
  return {
    type: 'input_file',
    ...(content.fileData ? { file_data: content.fileData } : {}),
    ...(content.fileId ? { file_id: content.fileId } : {}),
    ...(content.fileUrl ? { file_url: content.fileUrl } : {}),
    ...(content.filename ? { filename: content.filename } : {}),
  };
}

function isOpenAIReasoningInput(value: unknown): value is { type: 'reasoning'; [key: string]: unknown } {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && (value as { type?: unknown }).type === 'reasoning';
}

export function mapTextToolsToOpenAI(tools: TextTool[] = []): OpenAIRequestTool[] {
  return tools.map((tool) => {
    const { $schema, ...jsonSchema } = z.toJSONSchema(tool.parameters) as Record<string, unknown>;
    validateStrictJsonSchema(tool.parameters);

    return {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: jsonSchema,
      strict: tool.strict ?? true,
    };
  });
}

export function mapToolChoiceToOpenAI(toolChoice: TextToolChoice | undefined): OpenAIToolChoice | undefined {
  return toolChoice;
}

async function createOpenAIResponse(
  provider: Provider,
  request: GenerateTextBaseRequest & Pick<GenerateTextRequest, 'tools' | 'toolChoice' | 'parallelToolCalls' | 'reasoning'>,
  text?: Record<string, unknown>,
  endpoint?: OpenAICompatibleEndpoint,
): Promise<OpenAIResponsesResponse> {
  const tools = mapTextToolsToOpenAI(request.tools);
  const response = await openAIJsonRequest<OpenAIResponsesResponse>(provider, '/responses', {
    model: request.model,
    instructions: request.instructions,
    input: mapTextInputToOpenAI(request.input),
    ...(text ? { text } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    ...(request.toolChoice ? { tool_choice: mapToolChoiceToOpenAI(request.toolChoice) } : {}),
    ...(tools.length > 0 ? { parallel_tool_calls: request.parallelToolCalls ?? false } : {}),
    ...(request.reasoning ? { reasoning: request.reasoning, include: ['reasoning.encrypted_content'] } : {}),
    store: false,
  }, endpoint);

  if (response.status === 'failed') {
    throw new Error(`Responses API call failed: ${response.error?.message || 'Unknown error'}`);
  }

  return response;
}

function getRequiredOutputText(response: OpenAIResponsesResponse): string {
  const text = response.output_text || getOpenAIMessageText(response);
  if (!text) {
    throw new Error('Responses API did not return output_text.');
  }
  return text;
}

export function mapOpenAIOutputToTextOutput(
  response: OpenAIResponsesResponse,
  tools: TextTool[] = [],
): TextOutputItem[] {
  return (response.output ?? []).map((item) => {
    if (item.type === 'message') {
      return { type: 'message', text: getOpenAIMessageTexts({ output: [item] }).join('') };
    }
    if (item.type === 'function_call') {
      return { type: 'function_call', func: mapOpenAIFunctionCall(item, tools) };
    }
    if (item.type === 'reasoning') {
      return { type: 'reasoning', raw: item };
    }
    return {
      type: 'unknown',
      actualType: typeof item.type === 'string' ? item.type : undefined,
      raw: item,
    };
  });
}

function mapOpenAIUsageToGenerateTextUsage(
  response: OpenAIResponsesResponse,
): GenerateTextUsage | undefined {
  const usage = response.usage;
  if (!usage) {
    return undefined;
  }

  const result: GenerateTextUsage = {
    ...(typeof usage.input_tokens === 'number' ? { inputTokens: usage.input_tokens } : {}),
    ...(typeof usage.output_tokens === 'number' ? { outputTokens: usage.output_tokens } : {}),
    ...(typeof usage.total_tokens === 'number' ? { totalTokens: usage.total_tokens } : {}),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}

export function buildGenerateTextResponse(
  response: OpenAIResponsesResponse,
  request: Pick<GenerateTextRequest<ZodType | undefined>, 'outputSchema' | 'tools'>,
): GenerateTextResponse {
  const output = mapOpenAIOutputToTextOutput(response, request.tools);
  const hasFunctionCalls = output.some((item) => item.type === 'function_call');
  const text = getOpenAIMessageText(response);
  const usage = mapOpenAIUsageToGenerateTextUsage(response);

  return {
    output,
    ...(request.outputSchema && !hasFunctionCalls ? { structured: getRequiredOutputText(response) } : {}),
    ...(!request.outputSchema && text ? { text } : {}),
    ...(usage ? { usage } : {}),
  };
}

export async function generateTextOpenAI<TSchema extends ZodType | undefined = undefined>(
  provider: Provider,
  request: GenerateTextRequest<TSchema>,
  endpoint?: OpenAICompatibleEndpoint,
): Promise<GenerateTextResponse> {
  let textFormat: Record<string, unknown> | undefined;
  if (request.outputSchema) {
    if (!request.schemaName) {
      throw new Error('schemaName is required when outputSchema is provided.');
    }
    validateStrictJsonSchema(request.outputSchema);
    const { $schema, ...jsonSchema } = z.toJSONSchema(request.outputSchema) as Record<string, unknown>;
    textFormat = {
      format: {
        type: 'json_schema',
        name: request.schemaName,
        schema: jsonSchema,
        strict: true,
      },
    };
  }

  const response = await createOpenAIResponse(provider, request, textFormat, endpoint);
  return buildGenerateTextResponse(response, request);
}

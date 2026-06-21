import type { Provider } from './types.ts';
import type { ZodType } from 'zod';
import {
  generateText,
  type GenerateTextRequest,
  type GenerateTextResponse,
  type TextFunctionCall,
  type TextFunctionCallOutputContent,
  type TextFunctionCallOutputValue,
  type TextInput,
  type TextTool,
} from './text.ts';

export interface AgentLoopRequestContext {
  turn: number;
  maxTurns: number;
  isFinalTurn: boolean;
  input: TextInput;
  tools: TextTool[];
}

export interface AgentLoopToolContext {
  turn: number;
  maxTurns: number;
  input: TextInput;
  call: TextFunctionCall;
}

export interface AgentLoopFinalContext {
  turn: number;
  maxTurns: number;
  input: TextInput;
}

export interface AgentLoop<TOutput> {
  readonly maxTurns?: number;
  readonly model: string;
  readonly schemaName?: string;
  readonly outputSchema?: ZodType;
  readonly instructions?: string | ((context: AgentLoopRequestContext) => string);
  readonly initialInput: TextInput;
  readonly tools: AgentLoopTool[];
  parseFinal(response: GenerateTextResponse, context: AgentLoopFinalContext): TOutput;
}

export interface AgentLoopTool<TArgs = unknown, TResult = unknown> {
  readonly type: 'function';
  readonly name: string;
  readonly description: string;
  readonly parameters: ZodType<TArgs>;
  readonly strict?: boolean;
  execute(args: TArgs, context: AgentLoopToolContext): Promise<TResult> | TResult;
}

export type AgentLoopEvent<TOutput = unknown> =
  | { type: 'turn_started'; turn: number; maxTurns: number; finalTurn: boolean; input: TextInput }
  | { type: 'model_response'; turn: number; finalTurn: boolean; response: GenerateTextResponse }
  | { type: 'tool_call'; turn: number; call: TextFunctionCall }
  | { type: 'tool_result'; turn: number; call: TextFunctionCall; output: unknown }
  | { type: 'final_response'; turn: number; response: GenerateTextResponse; output: TOutput }
  | { type: 'failed'; turn?: number; error: unknown };

export interface RunAgentLoopOptions<TOutput = unknown> {
  onEvent?: AgentLoopEventHandler<TOutput>;
  generateText?: typeof generateText;
}

export type AgentLoopEventHandler<TOutput = unknown> =
  | ((event: AgentLoopEvent<TOutput>) => Promise<void> | void)
  | AgentLoopEventHandlers<TOutput>;

export interface AgentLoopEventHandlers<TOutput = unknown> {
  onTurnStarted?: (event: Extract<AgentLoopEvent<TOutput>, { type: 'turn_started' }>) => Promise<void> | void;
  onModelResponse?: (event: Extract<AgentLoopEvent<TOutput>, { type: 'model_response' }>) => Promise<void> | void;
  onToolCall?: (event: Extract<AgentLoopEvent<TOutput>, { type: 'tool_call' }>) => Promise<void> | void;
  onToolResult?: (event: Extract<AgentLoopEvent<TOutput>, { type: 'tool_result' }>) => Promise<void> | void;
  onFinalResponse?: (event: Extract<AgentLoopEvent<TOutput>, { type: 'final_response' }>) => Promise<void> | void;
  onFailed?: (event: Extract<AgentLoopEvent<TOutput>, { type: 'failed' }>) => Promise<void> | void;
}

export async function runAgentLoop<TOutput>(
  provider: Provider,
  agent: AgentLoop<TOutput>,
  options: RunAgentLoopOptions<TOutput> = {},
): Promise<TOutput> {
  const iterator = runAgentLoopSteps(provider, agent, options);
  let next = await iterator.next();
  while (!next.done) {
    await dispatchAgentLoopEvent(options.onEvent, next.value);
    next = await iterator.next();
  }
  return next.value;
}

async function dispatchAgentLoopEvent<TOutput>(
  handler: AgentLoopEventHandler<TOutput> | undefined,
  event: AgentLoopEvent<TOutput>,
): Promise<void> {
  if (!handler) {
    return;
  }

  if (typeof handler === 'function') {
    await handler(event);
    return;
  }

  switch (event.type) {
    case 'turn_started':
      await handler.onTurnStarted?.(event);
      return;
    case 'model_response':
      await handler.onModelResponse?.(event);
      return;
    case 'tool_call':
      await handler.onToolCall?.(event);
      return;
    case 'tool_result':
      await handler.onToolResult?.(event);
      return;
    case 'final_response':
      await handler.onFinalResponse?.(event);
      return;
    case 'failed':
      await handler.onFailed?.(event);
      return;
  }
}

export async function* runAgentLoopSteps<TOutput>(
  provider: Provider,
  agent: AgentLoop<TOutput>,
  options: Pick<RunAgentLoopOptions<TOutput>, 'generateText'> = {},
): AsyncGenerator<AgentLoopEvent<TOutput>, TOutput> {
  const maxTurns = agent.maxTurns ?? 20;
  const input: TextInput = [...agent.initialInput];
  const generate = options.generateText ?? generateText;
  const modelTools = mapAgentLoopToolsToTextTools(agent.tools);

  try {
    for (let turnIndex = 0; turnIndex < maxTurns; turnIndex++) {
      const turn = turnIndex + 1;
      const isFinalTurn = turn === maxTurns;
      yield { type: 'turn_started', turn, maxTurns, finalTurn: isFinalTurn, input: [...input] };

      const requestContext: AgentLoopRequestContext = {
        turn,
        maxTurns,
        isFinalTurn,
        input,
        tools: modelTools,
      };
      const response = await generate(provider, createAgentLoopGenerateTextRequest(agent, requestContext));
      yield { type: 'model_response', turn, finalTurn: isFinalTurn, response };

      const calls = response.output
        .filter((item) => item.type === 'function_call')
        .map((item) => item.func);

      if (calls.length === 0) {
        const output = agent.parseFinal(response, { turn, maxTurns, input });
        yield { type: 'final_response', turn, response, output };
        return output;
      }

      if (isFinalTurn) {
        throw new Error('Agent loop returned tool calls on the final turn.');
      }

      for (const call of calls) {
        yield { type: 'tool_call', turn, call };
        const output = await executeAgentLoopTool(agent.tools, call, { turn, maxTurns, input, call });
        yield { type: 'tool_result', turn, call, output };
        input.push({ type: 'function_call', func: call });
        input.push({
          type: 'function_call_output',
          callId: call.callId,
          output: formatAgentLoopToolOutput(output),
        });
      }
    }

    throw new Error(`Agent loop exceeded maxTurns (${maxTurns}) without producing final output.`);
  } catch (error) {
    yield { type: 'failed', error };
    throw error;
  }
}

export function createAgentLoopGenerateTextRequest(
  agent: AgentLoop<unknown>,
  context: AgentLoopRequestContext,
): GenerateTextRequest<ZodType | undefined> {
  return {
    model: agent.model,
    ...(agent.instructions ? { instructions: resolveInstructions(agent.instructions, context) } : {}),
    input: context.input,
    tools: context.tools,
    toolChoice: context.isFinalTurn ? 'none' : 'auto',
    ...(agent.schemaName ? { schemaName: agent.schemaName } : {}),
    ...(agent.outputSchema ? { outputSchema: agent.outputSchema } : {}),
  };
}

function resolveInstructions(
  instructions: string | ((context: AgentLoopRequestContext) => string),
  context: AgentLoopRequestContext,
): string {
  return typeof instructions === 'function' ? instructions(context) : instructions;
}

export function mapAgentLoopToolsToTextTools(tools: AgentLoopTool[]): TextTool[] {
  return tools.map(({ execute: _execute, ...tool }) => tool);
}

async function executeAgentLoopTool(
  tools: AgentLoopTool[],
  call: TextFunctionCall,
  context: AgentLoopToolContext,
): Promise<unknown> {
  const tool = tools.find((candidate) => candidate.name === call.name);
  if (!tool) {
    throw new Error(`Unknown agent loop tool: ${call.name}`);
  }
  const args = tool.parameters.parse(call.args);
  return tool.execute(args, context);
}

export function formatAgentLoopToolOutput(output: unknown): TextFunctionCallOutputValue {
  if (typeof output === 'string') {
    return output;
  }
  if (isTextFunctionCallOutputContentArray(output)) {
    return output;
  }
  return JSON.stringify(output);
}

function isTextFunctionCallOutputContentArray(value: unknown): value is TextFunctionCallOutputContent[] {
  return Array.isArray(value) && value.every(isTextFunctionCallOutputContent);
}

function isTextFunctionCallOutputContent(value: unknown): value is TextFunctionCallOutputContent {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const content = value as {
    type?: unknown;
    text?: unknown;
    dataUrl?: unknown;
    url?: unknown;
    fileId?: unknown;
    fileData?: unknown;
    fileUrl?: unknown;
  };

  if (content.type === 'text') {
    return typeof content.text === 'string';
  }
  if (content.type === 'image') {
    return typeof content.dataUrl === 'string'
      || typeof content.url === 'string'
      || typeof content.fileId === 'string';
  }
  if (content.type === 'file') {
    return typeof content.fileData === 'string'
      || typeof content.fileId === 'string'
      || typeof content.fileUrl === 'string';
  }
  return false;
}

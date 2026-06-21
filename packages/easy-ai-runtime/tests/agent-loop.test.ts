import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  formatAgentLoopToolOutput,
  runAgentLoop,
  type AgentLoop,
  type AgentLoopEvent,
  type AgentLoopTool,
} from '../src/agent-loop.ts';
import { parseStructuredTextResult, type GenerateTextResponse, type TextFunctionCall } from '../src/text.ts';

const OutputSchema = z.object({ ok: z.boolean() });

test('runAgentLoop executes tool calls until the model returns final output', async () => {
  const events: AgentLoopEvent<{ ok: boolean }>[] = [];
  const requests: { turn: number; toolChoice: unknown }[] = [];
  const responses: GenerateTextResponse[] = [
    {
      output: [{
        type: 'function_call',
        func: createFunctionCall('call_1', 'lookup', { id: 'alpha' }),
      }],
    },
    {
      output: [{ type: 'message', text: '{"ok":true}' }],
      structured: '{"ok":true}',
    },
  ];
  const agent: AgentLoop<{ ok: boolean }> = {
    maxTurns: 3,
    model: 'test-model',
    schemaName: 'result',
    outputSchema: OutputSchema,
    instructions: 'Use tools and then return structured output.',
    initialInput: [{ role: 'user', content: [{ type: 'text', text: 'start' }] }],
    tools: [createLookupTool((args) => ({ value: `result:${args.id}` }))],
    parseFinal: (response) => parseStructuredTextResult(response, OutputSchema),
  };

  const output = await runAgentLoop({ name: 'test', apiKey: 'unused' }, agent, {
    onEvent: (event) => {
      events.push(event);
    },
    generateText: async (_provider, request) => {
      requests.push({ turn: requests.length + 1, toolChoice: request.toolChoice });
      const response = responses.shift();
      if (!response) {
        throw new Error('No test response queued.');
      }
      return response;
    },
  });

  assert.deepEqual(output, { ok: true });
  assert.deepEqual(requests.map((request) => request.toolChoice), ['auto', 'auto']);
  assert.ok(events.some((event) => event.type === 'tool_call'));
  assert.ok(events.some((event) => event.type === 'tool_result'));
  assert.ok(events.some((event) => event.type === 'final_response'));
});

test('runAgentLoop accepts typed event handler objects', async () => {
  const called: string[] = [];
  const agent: AgentLoop<{ ok: boolean }> = {
    maxTurns: 1,
    model: 'test-model',
    schemaName: 'result',
    outputSchema: OutputSchema,
    initialInput: [{ role: 'user', content: [{ type: 'text', text: 'finish now' }] }],
    tools: [],
    parseFinal: (response) => parseStructuredTextResult(response, OutputSchema),
  };

  await runAgentLoop({ name: 'test', apiKey: 'unused' }, agent, {
    onEvent: {
      onTurnStarted: () => {
        called.push('turn');
      },
      onFinalResponse: () => {
        called.push('final');
      },
    },
    generateText: async () => ({
      output: [{ type: 'message', text: '{"ok":true}' }],
      structured: '{"ok":true}',
    }),
  });

  assert.deepEqual(called, ['turn', 'final']);
});

test('runAgentLoop exposes final turn so agents can disable tool calls', async () => {
  const toolChoices: unknown[] = [];
  const agent: AgentLoop<{ ok: boolean }> = {
    maxTurns: 1,
    model: 'test-model',
    schemaName: 'result',
    outputSchema: OutputSchema,
    initialInput: [{ role: 'user', content: [{ type: 'text', text: 'finish now' }] }],
    tools: [],
    parseFinal: (response) => parseStructuredTextResult(response, OutputSchema),
  };

  const output = await runAgentLoop({ name: 'test', apiKey: 'unused' }, agent, {
    generateText: async (_provider, request) => {
      toolChoices.push(request.toolChoice);
      return {
        output: [{ type: 'message', text: '{"ok":true}' }],
        structured: '{"ok":true}',
      };
    },
  });

  assert.deepEqual(output, { ok: true });
  assert.deepEqual(toolChoices, ['none']);
});

test('runAgentLoop rejects tool calls on the final turn', async () => {
  const agent: AgentLoop<never> = {
    maxTurns: 1,
    model: 'test-model',
    initialInput: [{ role: 'user', content: [{ type: 'text', text: 'start' }] }],
    tools: [createLookupTool(() => ({ value: 'unused' }))],
    parseFinal: () => {
      throw new Error('No final response expected.');
    },
  };

  await assert.rejects(
    () => runAgentLoop({ name: 'test', apiKey: 'unused' }, agent, {
      generateText: async () => ({
        output: [{
          type: 'function_call',
          func: createFunctionCall('call_1', 'lookup', { id: 'alpha' }),
        }],
      }),
    }),
    /Agent loop returned tool calls on the final turn/,
  );
});

test('formatAgentLoopToolOutput preserves multimodal output content and stringifies other values', () => {
  assert.equal(formatAgentLoopToolOutput('ok'), 'ok');
  assert.equal(formatAgentLoopToolOutput({ ok: true }), '{"ok":true}');
  assert.equal(formatAgentLoopToolOutput([{ ok: true }]), '[{"ok":true}]');

  const content = [
    { type: 'text' as const, text: 'preview' },
    { type: 'image' as const, dataUrl: 'data:image/png;base64,abc' },
    { type: 'file' as const, fileId: 'file_1' },
  ];
  assert.deepEqual(formatAgentLoopToolOutput(content), content);
});

function createFunctionCall(callId: string, name: string, args: Record<string, unknown>): TextFunctionCall {
  return {
    callId,
    name,
    args,
    rawArguments: JSON.stringify(args),
  };
}

function createLookupTool(
  execute: AgentLoopTool<{ id: string }>['execute'],
): AgentLoopTool<{ id: string }> {
  return {
    type: 'function',
    name: 'lookup',
    description: 'Lookup a value.',
    parameters: z.object({ id: z.string() }),
    execute,
  };
}

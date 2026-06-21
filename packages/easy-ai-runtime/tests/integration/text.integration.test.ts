import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Command } from 'commander';
import { z } from 'zod';
import {
  generateText,
  parseStructuredTextResult,
  type TextFunctionCall,
  type TextReasoningInput,
  type TextTool,
} from '../../src/index.ts';
import {
  createProvider,
  getProviderSkipReason,
  pngDataUrl,
  textFileDataUrl,
} from './helpers.ts';

interface IntegrationOptions {
  openaiApiKeyEnv: string;
  openaiModel: string;
  openaiReasoningModel: string;
  xaiApiKeyEnv: string;
  xaiModel: string;
  xaiReasoningModel: string;
}

interface ProviderIntegrationConfig {
  providerName: string;
  apiKey: string | undefined;
  model: string;
  reasoningModel: string;
}

const integrationOptions = parseIntegrationOptions(process.argv);

describe('easy-ai-runtime text API integration', () => {
  for (const provider of createProviderIntegrationConfigs(integrationOptions)) {
    generateTextTestCases(provider);
  }
});

function createProviderIntegrationConfigs(options: IntegrationOptions): ProviderIntegrationConfig[] {
  return [
    {
      providerName: 'openai',
      apiKey: process.env[options.openaiApiKeyEnv],
      model: options.openaiModel,
      reasoningModel: options.openaiReasoningModel,
    },
    {
      providerName: 'xai',
      apiKey: process.env[options.xaiApiKeyEnv],
      model: options.xaiModel,
      reasoningModel: options.xaiReasoningModel,
    },
  ];
}

function generateTextTestCases(provider: ProviderIntegrationConfig): void {
  const { providerName, apiKey, model, reasoningModel } = provider;
  const skip = getProviderSkipReason(providerName, apiKey);

  test(
    `${providerName} generateText maps input=[text] to output=[text]`,
    { skip, timeout: 60_000 },
    async () => {
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        instructions: 'Answer with exactly one short sentence.',
        input: [{
          role: 'user',
          content: [{ type: 'text', text: 'Say that the runtime text integration test is working.' }],
        }],
      });

      assert.ok(response.text);
      assert.ok(response.output.some((item) => item.type === 'message' && item.text.length > 0));
      assert.ok(response.usage?.inputTokens, 'Expected positive input token usage.');
      assert.ok(response.usage?.outputTokens, 'Expected positive output token usage.');
      assert.ok(response.usage?.totalTokens, 'Expected positive total token usage.');
      assert.ok(response.usage.totalTokens >= response.usage.inputTokens);
      assert.ok(response.usage.totalTokens >= response.usage.outputTokens);
    },
  );

  test(
    `${providerName} generateText maps input=[text], schema=[json] to output=[json]`,
    { skip, timeout: 60_000 },
    async () => {
      const outputSchema = z.object({
        ok: z.boolean(),
        label: z.string(),
      });
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        instructions: 'Return JSON that matches the supplied schema.',
        input: [{
          role: 'user',
          content: [{ type: 'text', text: 'Set ok to true and label to "runtime".' }],
        }],
        schemaName: 'runtime_text_integration',
        outputSchema,
      });

      const parsed = parseStructuredTextResult(response, outputSchema);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.label, 'runtime');
      assert.ok(response.structured);
    },
  );

  test(
    `${providerName} generateText maps input=[user:text, assistant:text, user:text] to output=[text]`,
    { skip, timeout: 60_000 },
    async () => {
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        instructions: 'Follow the last user request using the prior assistant message as context.',
        input: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Remember this code word: blue.' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'I will remember the code word blue.' }],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'What code word did you say you would remember? Answer with only the word.' }],
          },
        ],
      });

      assert.match(response.text ?? '', /blue/i);
      assert.ok(response.output.some((item) => item.type === 'message'));
    },
  );

  test(
    `${providerName} generateText maps input=[user:text,file] to output=[text]`,
    { skip, timeout: 60_000 },
    async () => {
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        instructions: 'Answer with only the marker value found in the supplied file.',
        input: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Read the attached file and return the RUNTIME_FILE_MARKER value.' },
            {
              type: 'file',
              fileData: textFileDataUrl('RUNTIME_FILE_MARKER=violet-739\n'),
              filename: 'runtime-marker.txt',
            },
          ],
        }],
      });

      assert.match(response.text ?? '', /violet-739/i);
      assert.ok(response.output.some((item) => item.type === 'message'));
    },
  );

  test(
    `${providerName} generateText maps input=[user:text,image] to output=[text]`,
    { skip, timeout: 60_000 },
    async () => {
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        instructions: 'Identify the dominant color in the supplied image. Answer with only the color name.',
        input: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is the dominant color in this image?' },
            { type: 'image', dataUrl: pngDataUrl(128, 128, [0, 0, 220]), detail: 'low' },
          ],
        }],
      });

      assert.match(response.text ?? '', /blue/i);
      assert.ok(response.output.some((item) => item.type === 'message'));
    },
  );

  test(
    `${providerName} generateText maps input=[text] to output=[text, reasoning], then replays reasoning to output=[text]`,
    { skip, timeout: 120_000 },
    async () => {
      const provider = createProvider(providerName, apiKey);
      const first = await generateText(provider, {
        model: reasoningModel,
        instructions: 'Solve the arithmetic problem. Answer only with the final number.',
        input: [{
          role: 'user',
          content: [{ type: 'text', text: 'What is 17 + 25?' }],
        }],
        reasoning: { effort: 'low' },
      });

      const reasoningInput = first.output
        .filter((item): item is Extract<typeof item, { type: 'reasoning' }> => item.type === 'reasoning')
        .map((item): TextReasoningInput => ({ type: 'reasoning', raw: item.raw }));

      assert.match(first.text ?? '', /42/);
      assert.ok(
        reasoningInput.length > 0,
        `Expected a reasoning output item. Received output types: ${first.output.map((item) => item.type).join(', ')}`,
      );

      const second = await generateText(provider, {
        model: reasoningModel,
        instructions: 'Use the prior reasoning context and answer only with the final number.',
        input: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'We are solving 17 + 25.' }],
          },
          ...reasoningInput,
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the final answer?' }],
          },
        ],
        reasoning: { effort: 'low' },
      });

      assert.match(second.text ?? '', /42/);
      assert.ok(second.output.some((item) => item.type === 'message'));
    },
  );

  test(
    `${providerName} generateText maps input=[user:text] to output=[tool_call]`,
    { skip, timeout: 60_000 },
    async () => {
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        input: [{
          role: 'user',
          content: [{ type: 'text', text: 'Use the lookup_color tool for item runtime_probe.' }],
        }],
        tools: [lookupColorTool],
        toolChoice: 'required',
      });

      const calls = response.output.filter((item) => item.type === 'function_call');
      assert.equal(calls.length, 1);
      const func = calls[0].func as TextFunctionCall<{ item: string }>;
      assert.equal(func.name, 'lookup_color');
      assert.equal(func.args.item, 'runtime_probe');
    },
  );

  test(
    `${providerName} generateText maps toolChoice={type:function,name} to the named function call`,
    { skip, timeout: 60_000 },
    async () => {
      const response = await generateText(createProvider(providerName, apiKey), {
        model,
        input: [{
          role: 'user',
          content: [{ type: 'text', text: 'Call the selected tool with item exactly runtime_probe.' }],
        }],
        tools: [lookupColorTool, lookupShapeTool],
        toolChoice: { type: 'function', name: 'lookup_shape' },
      });

      const calls = response.output.filter((item) => item.type === 'function_call');
      assert.equal(calls.length, 1);
      const func = calls[0].func as TextFunctionCall<{ item: string }>;
      assert.equal(func.name, 'lookup_shape');
      assert.equal(func.args.item, 'runtime_probe');
    },
  );

  test(
    `${providerName} generateText maps input=[user:text, assistant:function_call, user:function_call_output] to output=[text]`,
    { skip, timeout: 60_000 },
    async () => {
      const provider = createProvider(providerName, apiKey);
      const toolCall = await getLookupColorToolCall(provider, model);
      const response = await generateText(provider, {
        model,
        instructions: 'Use the supplied tool result to answer. Do not call tools.',
        input: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Use the lookup_color tool for item runtime_probe, then answer with the color.' }],
          },
          {
            type: 'function_call',
            func: toolCall,
          },
          {
            type: 'function_call_output',
            callId: toolCall.callId,
            output: '{"color":"green"}',
          },
        ],
        tools: [lookupColorTool],
        toolChoice: 'none',
      });

      assert.match(response.text ?? '', /green/i);
      assert.ok(response.output.some((item) => item.type === 'message'));
    },
  );

  test(
    `${providerName} generateText maps input=[user:text, assistant:function_call, user:function_call_output:text+image+file] to output=[text]`,
    { skip, timeout: 60_000 },
    async () => {
      const provider = createProvider(providerName, apiKey);
      const toolCall = await getLookupColorToolCall(provider, model);
      const response = await generateText(provider, {
        model,
        instructions: 'Use only the supplied tool result. Answer with the marker value and the image color.',
        input: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Use the lookup_color tool, then answer from its multimodal result.' }],
          },
          {
            type: 'function_call',
            func: toolCall,
          },
          {
            type: 'function_call_output',
            callId: toolCall.callId,
            output: [
              { type: 'text', text: 'The tool result includes one image and one marker file.' },
              { type: 'image', dataUrl: pngDataUrl(32, 32, [220, 0, 0]), detail: 'low' },
              {
                type: 'file',
                fileData: textFileDataUrl('RUNTIME_TOOL_FILE_MARKER=amber-482\n'),
                filename: 'runtime-tool-marker.txt',
              },
            ],
          },
        ],
        tools: [lookupColorTool],
        toolChoice: 'none',
      });

      assert.match(response.text ?? '', /amber-482/i);
      assert.match(response.text ?? '', /red/i);
      assert.ok(response.output.some((item) => item.type === 'message'));
    },
  );
}

const lookupColorTool: TextTool<{ item: string }> = {
  type: 'function',
  name: 'lookup_color',
  description: 'Look up the configured color for a test item.',
  parameters: z.object({
    item: z.string(),
  }),
};

const lookupShapeTool: TextTool<{ item: string }> = {
  type: 'function',
  name: 'lookup_shape',
  description: 'Look up the configured shape for a test item.',
  parameters: z.object({
    item: z.string(),
  }),
};

async function getLookupColorToolCall(
  provider: ReturnType<typeof createProvider>,
  model: string,
): Promise<TextFunctionCall<{ item: string }>> {
  const response = await generateText(provider, {
    model,
    input: [{
      role: 'user',
      content: [{ type: 'text', text: 'Use the lookup_color tool for item runtime_probe.' }],
    }],
    tools: [lookupColorTool],
    toolChoice: 'required',
  });
  const call = response.output.find((item) => item.type === 'function_call');
  assert.ok(call, 'Expected a function_call output item.');
  assert.equal(call.func.name, 'lookup_color');
  return call.func as TextFunctionCall<{ item: string }>;
}

function parseIntegrationOptions(argv: string[]): IntegrationOptions {
  const program = new Command()
    .option('--openai-api-key-env <name>', 'Environment variable name that contains the OpenAI API key', 'OPENAI_API_KEY')
    .option('--openai-model <model>', 'OpenAI model for text integration tests', 'gpt-5.4-mini')
    .option('--openai-reasoning-model <model>', 'OpenAI reasoning model for reasoning integration tests', 'o4-mini')
    .option('--xai-api-key-env <name>', 'Environment variable name that contains the xAI API key', 'XAI_API_KEY')
    .option('--xai-model <model>', 'xAI model for text integration tests', 'grok-4.3')
    .option('--xai-reasoning-model <model>', 'xAI reasoning model for reasoning integration tests', 'grok-4.3');

  program.parse(argv, { from: 'node' });
  return program.opts<IntegrationOptions>();
}

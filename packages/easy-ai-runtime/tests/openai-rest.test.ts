import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { buildGenerateImageResponse, buildImageEditFormData } from '../src/openai/image.ts';
import { readOpenAIResponse } from '../src/openai/rest.ts';
import {
  buildGenerateTextResponse,
  getOpenAIFunctionCall,
  getOpenAIFunctionCalls,
  getOpenAIMessageText,
  mapOpenAIOutputToTextOutput,
  mapTextInputToOpenAI,
  mapTextToolsToOpenAI,
  parseFunctionCallArguments,
} from '../src/openai/text.ts';
import { parseStructuredTextResult } from '../src/text.ts';

test('buildImageEditFormData maps params and reference images to multipart fields', async () => {
  const formData = buildImageEditFormData(
    {
      model: 'gpt-image-2',
      prompt: 'a cat',
      n: 1,
      size: 'auto',
      quality: 'auto',
      moderation: 'auto',
    },
    [{
      data: Buffer.from('jpeg-bytes'),
      mimeType: 'image/jpeg',
      name: 'ref.jpg',
    }],
  );

  assert.equal(formData.get('model'), 'gpt-image-2');
  assert.equal(formData.get('prompt'), 'a cat');
  assert.equal(formData.get('stream'), 'false');
  const file = formData.get('image[]');
  assert.ok(file instanceof File);
  assert.equal(file.name, 'ref.jpg');
  assert.equal(file.type, 'image/jpeg');
  assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'jpeg-bytes');
});

test('buildGenerateImageResponse maps image data and token usage', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = buildGenerateImageResponse({
    data: [{ b64_json: png.toString('base64') }],
    usage: {
      input_tokens: 120,
      output_tokens: 80,
      total_tokens: 200,
    },
  });

  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].format, 'png');
  assert.deepEqual([...result.images[0].data], [...png]);
  assert.deepEqual(result.usage, {
    inputTokens: 120,
    outputTokens: 80,
    totalTokens: 200,
  });
});

test('buildGenerateImageResponse detects jpeg image data', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const result = buildGenerateImageResponse({
    data: [{ b64_json: jpeg.toString('base64') }],
  });

  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].format, 'jpeg');
  assert.deepEqual([...result.images[0].data], [...jpeg]);
});

test('readOpenAIResponse parses successful JSON and formats failed JSON bodies', async () => {
  const ok = await readOpenAIResponse<{ value: number }>(
    new Response(JSON.stringify({ value: 1 }), { status: 200 }),
  );
  assert.deepEqual(ok, { value: 1 });

  await assert.rejects(
    () => readOpenAIResponse(new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 })),
    /OpenAI API request failed: 400 .*bad request/,
  );
});

test('mapTextInputToOpenAI maps text, image, and file message content', () => {
  const result = mapTextInputToOpenAI([
    {
      role: 'user',
      content: [
        { type: 'text', text: 'inspect' },
        { type: 'image', dataUrl: 'data:image/png;base64,abc' },
        { type: 'image', url: 'https://example.com/image.png', detail: 'low' },
        { type: 'image', fileId: 'file_img_1' },
        { type: 'file', fileUrl: 'https://example.com/doc.pdf' },
        { type: 'file', fileId: 'file_doc_1', filename: 'doc.pdf' },
      ],
    },
  ]);

  assert.deepEqual(result, [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: 'inspect' },
        { type: 'input_image', image_url: 'data:image/png;base64,abc', detail: 'auto' },
        { type: 'input_image', image_url: 'https://example.com/image.png', detail: 'low' },
        { type: 'input_image', file_id: 'file_img_1', detail: 'auto' },
        { type: 'input_file', file_url: 'https://example.com/doc.pdf' },
        { type: 'input_file', file_id: 'file_doc_1', filename: 'doc.pdf' },
      ],
    },
  ]);
});

test('mapTextInputToOpenAI maps function call output input items', () => {
  const result = mapTextInputToOpenAI([
    {
      role: 'user',
      content: [{ type: 'text', text: 'what is the weather?' }],
    },
    {
      type: 'function_call_output',
      callId: 'call_1',
      output: '{"temperature":25}',
    },
  ]);

  assert.deepEqual(result, [
    {
      role: 'user',
      content: [{ type: 'input_text', text: 'what is the weather?' }],
    },
    {
      type: 'function_call_output',
      call_id: 'call_1',
      output: '{"temperature":25}',
    },
  ]);
});

test('mapTextInputToOpenAI maps multimodal function call output content', () => {
  const result = mapTextInputToOpenAI([
    {
      type: 'function_call_output',
      callId: 'call_1',
      output: [
        { type: 'text', text: 'rendered preview' },
        { type: 'image', dataUrl: 'data:image/png;base64,abc', detail: 'high' },
        { type: 'image', fileId: 'file_img_1' },
        { type: 'file', fileData: 'data:text/plain;base64,Zm9v', filename: 'foo.txt' },
      ],
    },
  ]);

  assert.deepEqual(result, [
    {
      type: 'function_call_output',
      call_id: 'call_1',
      output: [
        { type: 'input_text', text: 'rendered preview' },
        { type: 'input_image', image_url: 'data:image/png;base64,abc', detail: 'high' },
        { type: 'input_image', file_id: 'file_img_1', detail: 'auto' },
        { type: 'input_file', file_data: 'data:text/plain;base64,Zm9v', filename: 'foo.txt' },
      ],
    },
  ]);
});

test('mapTextInputToOpenAI maps assistant text to output_text', () => {
  const result = mapTextInputToOpenAI([
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'remembered value' }],
    },
  ]);

  assert.deepEqual(result, [
    {
      role: 'assistant',
      content: [{ type: 'output_text', text: 'remembered value' }],
    },
  ]);
});

test('mapTextInputToOpenAI rejects assistant file and image content', () => {
  assert.throws(
    () => mapTextInputToOpenAI([
      {
        role: 'assistant',
        content: [{ type: 'file', fileId: 'file_doc_1' }],
      },
    ]),
    /Assistant file and image content is not supported/,
  );
});

test('mapTextInputToOpenAI maps function call input items', () => {
  const result = mapTextInputToOpenAI([
    {
      type: 'function_call',
      func: {
        id: 'fc_1',
        callId: 'call_1',
        name: 'get_weather',
        args: { city: 'Taipei' },
        rawArguments: '{"city":"Taipei"}',
      },
    },
  ]);

  assert.deepEqual(result, [
    {
      type: 'function_call',
      id: 'fc_1',
      call_id: 'call_1',
      name: 'get_weather',
      arguments: '{"city":"Taipei"}',
    },
  ]);
});

test('mapTextInputToOpenAI maps reasoning input items', () => {
  const raw = {
    type: 'reasoning',
    id: 'rs_1',
    summary: [],
  };

  assert.deepEqual(mapTextInputToOpenAI([{ type: 'reasoning', raw }]), [raw]);
  assert.throws(
    () => mapTextInputToOpenAI([{ type: 'reasoning', raw: { type: 'message' } }]),
    /Reasoning input raw item must be an object with type "reasoning"/,
  );
});

test('getOpenAIMessageText extracts output_text from response output items', () => {
  assert.equal(getOpenAIMessageText({
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: '{"ok":' }],
      },
      {
        type: 'message',
        content: [{ type: 'output_text', text: 'true}' }],
      },
    ],
  }), '{"ok":true}');
});

test('getOpenAIFunctionCalls extracts and validates function call arguments', () => {
  const parameters = z.object({ city: z.string() });
  const response = {
    output: [
      {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_1',
        name: 'get_weather',
        arguments: '{"city":"Taipei"}',
      },
      {
        type: 'function_call',
        id: 'fc_2',
        call_id: 'call_2',
        name: 'get_weather',
        arguments: '{"city":"Tokyo"}',
      },
    ],
  };
  const tools = [{
    type: 'function' as const,
    name: 'get_weather',
    description: 'Get weather.',
    parameters,
  }];
  const result = getOpenAIFunctionCalls(response, tools);

  assert.deepEqual(result, [
    {
      id: 'fc_1',
      callId: 'call_1',
      name: 'get_weather',
      args: { city: 'Taipei' },
      rawArguments: '{"city":"Taipei"}',
    },
    {
      id: 'fc_2',
      callId: 'call_2',
      name: 'get_weather',
      args: { city: 'Tokyo' },
      rawArguments: '{"city":"Tokyo"}',
    },
  ]);

  assert.deepEqual(getOpenAIFunctionCall(response, tools), result[0]);
  assert.deepEqual(parseFunctionCallArguments(result[0], parameters), { city: 'Taipei' });
});

test('mapOpenAIOutputToTextOutput preserves output item order', () => {
  const parameters = z.object({ city: z.string() });
  const result = mapOpenAIOutputToTextOutput({
    output: [
      { type: 'reasoning', summary: [] },
      {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_1',
        name: 'get_weather',
        arguments: '{"city":"Taipei"}',
      },
      {
        type: 'message',
        content: [{ type: 'output_text', text: 'done' }],
      },
      {
        type: 'web_search_call',
        id: 'ws_1',
      },
    ],
  }, [{
    type: 'function',
    name: 'get_weather',
    description: 'Get weather.',
    parameters,
  }]);

  assert.equal(result[0].type, 'reasoning');
  assert.deepEqual(result[1], {
    type: 'function_call',
    func: {
      id: 'fc_1',
      callId: 'call_1',
      name: 'get_weather',
      args: { city: 'Taipei' },
      rawArguments: '{"city":"Taipei"}',
    },
  });
  assert.deepEqual(result[2], { type: 'message', text: 'done' });
  assert.deepEqual(result[3], { type: 'unknown', actualType: 'web_search_call', raw: { type: 'web_search_call', id: 'ws_1' } });
});

test('mapTextToolsToOpenAI maps strict function tools', () => {
  const result = mapTextToolsToOpenAI([{
    type: 'function',
    name: 'get_weather',
    description: 'Get weather.',
    parameters: z.object({ city: z.string() }),
  }]);

  assert.equal(result[0].type, 'function');
  assert.equal(result[0].name, 'get_weather');
  assert.equal(result[0].strict, true);
  assert.deepEqual(result[0].parameters.required, ['city']);
  assert.equal(result[0].parameters.additionalProperties, false);
});

test('buildGenerateTextResponse does not require structured text for schema tool-call turns', () => {
  const outputSchema = z.object({ ok: z.boolean() });
  const parameters = z.object({ city: z.string() });
  const result = buildGenerateTextResponse({
    output: [{
      type: 'function_call',
      id: 'fc_1',
      call_id: 'call_1',
      name: 'get_weather',
      arguments: '{"city":"Taipei"}',
    }],
  }, {
    outputSchema,
    tools: [{
      type: 'function',
      name: 'get_weather',
      description: 'Get weather.',
      parameters,
    }],
  });

  assert.equal(result.structured, undefined);
  assert.equal(result.output.length, 1);
  assert.deepEqual(result.output[0], {
    type: 'function_call',
    func: {
      id: 'fc_1',
      callId: 'call_1',
      name: 'get_weather',
      args: { city: 'Taipei' },
      rawArguments: '{"city":"Taipei"}',
    },
  });
});

test('buildGenerateTextResponse maps Responses API token usage', () => {
  const result = buildGenerateTextResponse({
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text: 'done' }],
    }],
    usage: {
      input_tokens: 12,
      output_tokens: 5,
      total_tokens: 17,
    },
  }, {});

  assert.deepEqual(result.usage, {
    inputTokens: 12,
    outputTokens: 5,
    totalTokens: 17,
  });
});

test('parseStructuredTextResult parses structured generateText responses', () => {
  const outputSchema = z.object({ ok: z.boolean() });

  assert.deepEqual(
    parseStructuredTextResult({ output: [], structured: '{"ok":true}' }, outputSchema),
    { ok: true },
  );
  assert.throws(
    () => parseStructuredTextResult({ output: [], text: 'not json' }, outputSchema),
    /Expected structured text response/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImage, listImageModels } from '../src/image.ts';
import { generateText } from '../src/text.ts';
import { buildXAIImageEditBody, buildXAIImageGenerationBody } from '../src/xai/image.ts';

test('generateText routes xAI requests to the xAI Responses API', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: 'hello from xai' }],
      }],
    }), { status: 200 });
  };

  try {
    const response = await generateText(
      { name: 'xai', apiKey: 'xai-key' },
      {
        model: 'grok-4.3',
        instructions: 'Be brief.',
        input: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      },
    );

    assert.equal(response.text, 'hello from xai');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.x.ai/v1/responses');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: 'Bearer xai-key',
      'Content-Type': 'application/json',
    });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      model: 'grok-4.3',
      instructions: 'Be brief.',
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: 'hello' }],
      }],
      store: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('listImageModels routes xAI requests to the xAI models API', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      data: [
        { id: 'grok-4.3' },
        { id: 'grok-imagine-image-quality' },
        { id: 'grok-imagine-video-1.5' },
      ],
    }), { status: 200 });
  };

  try {
    const models = await listImageModels({ name: 'xai', apiKey: 'xai-key' });

    assert.deepEqual(models, ['grok-imagine-image-quality']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.x.ai/v1/models');
    assert.equal(calls[0].init?.method, 'GET');
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: 'Bearer xai-key',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateImage routes prompt-only xAI requests to the xAI image generation API', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      data: [{ b64_json: png.toString('base64') }],
    }), { status: 200 });
  };

  try {
    const response = await generateImage(
      { name: 'xai', apiKey: 'xai-key' },
      {
        model: 'grok-imagine-image-quality',
        prompt: 'prompt',
        images: [],
        options: {
          count: 2,
          aspectRatio: '16:9',
          resolution: '2k',
        },
      },
    );

    assert.equal(response.images.length, 1);
    assert.equal(response.images[0].format, 'png');
    assert.deepEqual([...response.images[0].data], [...png]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.x.ai/v1/images/generations');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: 'Bearer xai-key',
      'Content-Type': 'application/json',
    });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      model: 'grok-imagine-image-quality',
      prompt: 'prompt',
      n: 2,
      response_format: 'b64_json',
      aspect_ratio: '16:9',
      resolution: '2k',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateImage routes xAI reference image requests to the JSON image edits API', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      data: [{ b64_json: jpeg.toString('base64') }],
    }), { status: 200 });
  };

  try {
    const response = await generateImage(
      { name: 'xai', apiKey: 'xai-key' },
      {
        model: 'grok-imagine-image-quality',
        prompt: 'render as pencil sketch',
        images: [{
          data: Buffer.from('reference-image'),
          mimeType: 'image/png',
          name: 'reference.png',
        }],
        options: {},
      },
    );

    assert.equal(response.images[0].format, 'jpeg');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.x.ai/v1/images/edits');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      model: 'grok-imagine-image-quality',
      prompt: 'render as pencil sketch',
      n: 1,
      response_format: 'b64_json',
      image: {
        type: 'image_url',
        url: `data:image/png;base64,${Buffer.from('reference-image').toString('base64')}`,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buildXAIImageGenerationBody maps xAI image generation options', () => {
  assert.deepEqual(buildXAIImageGenerationBody({
    model: 'grok-imagine-image-quality',
    prompt: 'prompt',
    images: [],
    options: {
      count: 3,
      aspectRatio: '1:1',
      resolution: '1k',
      size: '1024x1024',
      quality: 'low',
      moderation: 'auto',
    },
  }), {
    model: 'grok-imagine-image-quality',
    prompt: 'prompt',
    n: 3,
    response_format: 'b64_json',
    aspect_ratio: '1:1',
    resolution: '1k',
  });
});

test('buildXAIImageEditBody maps multiple references and limits xAI edits to three images', () => {
  const request = {
    model: 'grok-imagine-image-quality',
    prompt: 'combine references',
    images: [
      { data: Buffer.from('one'), mimeType: 'image/png' },
      { data: Buffer.from('two'), mimeType: 'image/jpeg' },
    ],
    options: {
      aspectRatio: '3:2',
    },
  };

  assert.deepEqual(buildXAIImageEditBody(request), {
    model: 'grok-imagine-image-quality',
    prompt: 'combine references',
    n: 1,
    response_format: 'b64_json',
    aspect_ratio: '3:2',
    images: [
      { type: 'image_url', url: `data:image/png;base64,${Buffer.from('one').toString('base64')}` },
      { type: 'image_url', url: `data:image/jpeg;base64,${Buffer.from('two').toString('base64')}` },
    ],
  });

  assert.throws(
    () => buildXAIImageEditBody({
      ...request,
      images: [
        ...request.images,
        { data: Buffer.from('three'), mimeType: 'image/png' },
        { data: Buffer.from('four'), mimeType: 'image/png' },
      ],
    }),
    /at most 3 reference images/,
  );
});

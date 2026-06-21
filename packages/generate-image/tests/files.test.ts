import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadReferenceImages } from '../src/files.ts';

const supportedReferenceImages = [
  {
    name: 'reference.jpg',
    mimeType: 'image/jpeg',
    data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
  },
  {
    name: 'reference.png',
    mimeType: 'image/png',
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    name: 'reference.webp',
    mimeType: 'image/webp',
    data: Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x08, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]),
  },
];

for (const supportedImage of supportedReferenceImages) {
  test(`loadReferenceImages accepts ${supportedImage.mimeType} references`, async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-'));
    const imagePath = path.join(tmpRoot, supportedImage.name);
    await fs.writeFile(imagePath, supportedImage.data);

    const references = await loadReferenceImages([imagePath]);

    assert.equal(references.length, 1);
    assert.equal(references[0].name, supportedImage.name);
    assert.equal(references[0].mimeType, supportedImage.mimeType);
    assert.deepEqual([...references[0].data], [...supportedImage.data]);
  });
}

test('loadReferenceImages error lists supported reference formats', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-image-'));
  const badPath = path.join(tmpRoot, 'reference.gif');
  await fs.writeFile(badPath, Buffer.from('GIF89a'));

  await assert.rejects(
    () => loadReferenceImages([badPath]),
    /Only JPEG, PNG, and WebP are supported/,
  );
});

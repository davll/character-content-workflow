import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { CharacterRegistry, CharacterRegistryService } from '../src/index.ts';
import type { SheetAttachData } from '../src/index.ts';
import { createFileTestWorkspace } from './helpers.ts';

describe('CharacterRegistryService', () => {
  test('rejects sheet attach without path or source image', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    const registry = await CharacterRegistry.init(workspace.yamlPath);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    const service = new CharacterRegistryService(registry);

    await assert.rejects(
      async () => {
        await service.attachSheet('g1', 's1', { summary: 'missing image and path' });
      },
      /without a path or source image/
    );
  });

  test('copies source image and writes relative sheet path', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await fs.writeFile(workspace.sourceImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const registry = await CharacterRegistry.init(workspace.yamlPath);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    const service = new CharacterRegistryService(registry);

    await service.attachSheet('g1', 's1', { summary: 'copied image' }, workspace.sourceImagePath);

    const sheet = registry.getGroupSheets('g1')?.s1;
    assert.equal(sheet?.path, 'groups/g1/sheets/outfits/g1_s1.png');
    assert.ok(await fs.stat(path.resolve(workspace.rootPath, sheet!.path)));
  });

  test('rejects unsupported source image formats', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    const webpPath = path.join(workspace.rootPath, 'source.webp');
    await fs.writeFile(webpPath, Buffer.from('RIFFxxxxWEBP'));

    const registry = await CharacterRegistry.init(workspace.yamlPath);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    const service = new CharacterRegistryService(registry);

    await assert.rejects(
      async () => {
        await service.attachSheet('g1', 's1', { summary: 'unsupported image' }, webpPath);
      },
      /Only JPEG and PNG are supported/
    );

    assert.equal(registry.getGroupSheets('g1')?.s1, undefined);
  });

  test('rejects unsafe sheet IDs before attaching source files', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await fs.writeFile(workspace.sourceImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const registry = await CharacterRegistry.init(workspace.yamlPath);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    const service = new CharacterRegistryService(registry);

    await assert.rejects(
      async () => {
        await service.attachSheet('g1', '../bad', { summary: 'bad id' }, workspace.sourceImagePath);
      },
      /IDs may only contain/
    );

    await assert.rejects(
      async () => {
        await fs.stat(path.resolve(workspace.rootPath, 'bad.png'));
      },
      { code: 'ENOENT' }
    );
  });

  test('validates sheet data before copying source image', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await fs.writeFile(workspace.sourceImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const registry = await CharacterRegistry.init(workspace.yamlPath);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    const service = new CharacterRegistryService(registry);

    await assert.rejects(
      async () => {
        await service.attachSheet(
          'g1',
          's1',
          {
            summary: 'invalid prompt building',
            prompt_building: {
              descriptions: {
                style: 'not an array',
              },
            },
          } as unknown as SheetAttachData,
          workspace.sourceImagePath
        );
      },
      { name: 'ZodError' }
    );

    await assert.rejects(
      async () => {
        await fs.stat(path.join(workspace.rootPath, 'groups', 'g1', 'sheets', 'outfits', 'g1_s1.png'));
      },
      { code: 'ENOENT' }
    );
  });
});

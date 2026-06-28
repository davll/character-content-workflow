import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createFileTestWorkspace, validRegistryYaml, writeRegistryYaml } from './helpers.ts';
import { ObjectRegistry } from '../src/index.ts';

describe('ObjectRegistry query API', () => {
  test('listObjects includes inference summary fields', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml());
    const registry = await ObjectRegistry.loadFromFile(workspace.yamlPath);

    assert.deepEqual(registry.listObjects(), [
      {
        id: 'vintage_rangefinder',
        names: ['Vintage 35mm rangefinder', 'Compact rangefinder camera'],
        category: 'camera',
        subtype: '35mm rangefinder',
        summary: 'Compact vintage-style 35mm rangefinder camera.',
        usage_profiles: ['carrying', 'shooting'],
      },
    ]);
  });

  test('searchObjects matches aliases and summaries', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml());
    const registry = await ObjectRegistry.loadFromFile(workspace.yamlPath);

    assert.equal(registry.searchObjects('compact')[0]?.id, 'vintage_rangefinder');
    assert.equal(registry.searchObjects('rangefinder')[0]?.id, 'vintage_rangefinder');
    assert.deepEqual(registry.searchObjects('nikon'), []);
  });

  test('getObjectInfo returns all prompt-building data and resolved references', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml());
    const registry = await ObjectRegistry.loadFromFile(workspace.yamlPath);

    assert.deepEqual(registry.getObjectInfo('vintage_rangefinder'), {
      id: 'vintage_rangefinder',
      names: ['Vintage 35mm rangefinder', 'Compact rangefinder camera'],
      category: 'camera',
      subtype: '35mm rangefinder',
      summary: 'Compact vintage-style 35mm rangefinder camera.',
      visual_traits: [
        'compact silver-and-black metal rangefinder body',
        'small lens',
        'flat top plate with a slim viewfinder window',
      ],
      accessories: ['thin neck or wrist strap'],
      usage_profiles: {
        carrying: ['held one-handed at waist or chest height'],
        shooting: ['raised to one eye with compact rangefinder grip'],
      },
      constraints: ['Keep the body compact, flat-topped, and lighter in handling than a larger SLR.'],
      reference_images: [
        {
          id: 'front_angle',
          path: 'references/fixture.png',
          role: 'object_design',
          prompt_usage: 'Use only for compact rangefinder body shape and rangefinder details.',
          resolved_path: workspace.pngPath,
        },
      ],
    });
  });

  test('getReferencePath returns undefined for missing references', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml());
    const registry = await ObjectRegistry.loadFromFile(workspace.yamlPath);

    assert.equal(registry.getReferencePath('vintage_rangefinder', 'missing'), undefined);
    assert.equal(registry.getReferencePath('missing', 'front_angle'), undefined);
  });
});

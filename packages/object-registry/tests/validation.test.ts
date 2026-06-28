import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { createFileTestWorkspace, validRegistryYaml, writeRegistryYaml } from './helpers.ts';
import { ObjectRegistry } from '../src/index.ts';

describe('ObjectRegistry validation', () => {
  test('loads a valid object registry yaml', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml());

    const registry = await ObjectRegistry.loadFromFile(workspace.yamlPath);

    assert.equal(registry.getObject('vintage_rangefinder')?.category, 'camera');
    assert.equal(registry.getReferencePath('vintage_rangefinder', 'front_angle'), workspace.pngPath);
  });

  test('rejects duplicate aliases deterministically', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, `
objects:
  vintage_rangefinder:
    names: [Vintage 35mm rangefinder]
    category: camera
    summary: A rangefinder.
    visual_traits: [compact body]
    usage_profiles:
      carrying: [held at chest height]
    constraints: []
  duplicate:
    names: [ vintage 35mm rangefinder ]
    category: camera
    summary: Duplicate alias.
    visual_traits: [compact body]
    usage_profiles:
      carrying: [held at chest height]
    constraints: []
`);

    await assert.rejects(
      () => ObjectRegistry.loadFromFile(workspace.yamlPath),
      /Duplicate object alias "vintage 35mm rangefinder"/
    );
  });

  test('rejects unsafe reference paths', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml(`
  bad_path:
    names: [Bad Path]
    category: other
    summary: Bad path.
    visual_traits: [bad]
    usage_profiles:
      carrying: [bad]
    reference_images:
      - id: bad
        path: ../outside.png
        role: object_design
        prompt_usage: bad
`));

    await assert.rejects(
      () => ObjectRegistry.loadFromFile(workspace.yamlPath),
      /path must stay inside the registry root/
    );
  });

  test('rejects absolute reference paths', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    const absolutePath = path.resolve(workspace.pngPath).replace(/\\/g, '\\\\');
    await writeRegistryYaml(workspace, validRegistryYaml(`
  absolute_path:
    names: [Absolute Path]
    category: other
    summary: Bad path.
    visual_traits: [bad]
    usage_profiles:
      carrying: [bad]
    reference_images:
      - id: bad
        path: "${absolutePath}"
        role: object_design
        prompt_usage: bad
`));

    await assert.rejects(
      () => ObjectRegistry.loadFromFile(workspace.yamlPath),
      /path must be relative/
    );
  });

  test('rejects missing reference files', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml(`
  missing_ref:
    names: [Missing Ref]
    category: other
    summary: Missing reference.
    visual_traits: [missing]
    usage_profiles:
      carrying: [missing]
    reference_images:
      - id: missing
        path: references/missing.png
        role: object_design
        prompt_usage: missing
`));

    await assert.rejects(
      () => ObjectRegistry.loadFromFile(workspace.yamlPath),
      /file does not exist/
    );
  });

  test('rejects non-image reference files by content signature', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml(`
  text_ref:
    names: [Text Ref]
    category: other
    summary: Text reference.
    visual_traits: [text]
    usage_profiles:
      carrying: [text]
    reference_images:
      - id: text
        path: references/not-image.png
        role: object_design
        prompt_usage: text
`));

    await assert.rejects(
      () => ObjectRegistry.loadFromFile(workspace.yamlPath),
      /must be a JPEG or PNG image by content signature/
    );
  });

  test('getters do not expose mutable registry state', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, validRegistryYaml());
    const registry = await ObjectRegistry.loadFromFile(workspace.yamlPath);

    registry.getAllObjects().vintage_rangefinder.names[0] = 'Mutated';
    registry.getObject('vintage_rangefinder')!.visual_traits[0] = 'Mutated';

    assert.equal(registry.getObject('vintage_rangefinder')?.names[0], 'Vintage 35mm rangefinder');
    assert.equal(registry.getObject('vintage_rangefinder')?.visual_traits[0], 'compact silver-and-black metal rangefinder body');
  });
});

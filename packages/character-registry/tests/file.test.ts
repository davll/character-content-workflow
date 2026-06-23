import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  CharacterRegistry,
  loadCharacterRegistryFromFile,
  saveCharacterRegistryToFile,
} from '../src/index.ts';
import { createFileTestWorkspace, writeRegistryYaml } from './helpers.ts';

describe('CharacterRegistry file I/O', () => {
  test('loads a registry from YAML', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    await writeRegistryYaml(workspace, `
characters:
  mike: { names: ["Mike"] }
groups:
  g1:
    characters: ["mike"]
    sheets:
      s1: { path: "img.png", summary: "desc" }
`);

    const registry = await loadCharacterRegistryFromFile(workspace.yamlPath);

    assert.equal(registry.rootPath, path.resolve(workspace.rootPath));
    assert.equal(registry.getCharacter('mike')?.names[0], 'Mike');
    assert.equal(registry.getGroupSheets('g1')?.s1.summary, 'desc');
  });

  test('saves a registry to YAML and creates target directories', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    const registry = CharacterRegistry.empty(workspace.rootPath);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    registry.addSheetToGroup('g1', 's1', { path: 'img.png', summary: 'desc' });

    const savePath = path.join(workspace.rootPath, 'nested', 'index.yaml');
    await saveCharacterRegistryToFile(registry, savePath);

    const reloaded = await loadCharacterRegistryFromFile(savePath);
    assert.equal(reloaded.getCharacter('mike')?.names[0], 'Mike');
    assert.equal(reloaded.getGroupSheets('g1')?.s1.path, 'img.png');
  });

  test('keeps static loadFromFile, init, and saveToFile compatibility wrappers', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    const registry = await CharacterRegistry.init(workspace.yamlPath);
    registry.addCharacter('new_char', { names: ['New Character'], characteristics: ['cool'] });
    registry.addGroup('new_group', { characters: ['new_char'] });
    registry.addSheetToGroup('new_group', 'new_sheet', { path: 'new.png', summary: 'New Sheet' });
    await registry.saveToFile();

    const saved = await fs.readFile(workspace.yamlPath, 'utf8');
    const reloaded = await CharacterRegistry.loadFromFile(workspace.yamlPath);

    assert.match(saved, /new_char/);
    assert.equal(reloaded.getCharacter('new_char')?.names[0], 'New Character');
    assert.equal(reloaded.getGroupSheets('new_group')?.new_sheet.path, 'new.png');
  });

  test('saveToFile requires a target path when registry has no file path', async (t) => {
    const workspace = await createFileTestWorkspace(t);
    const registry = CharacterRegistry.empty(workspace.rootPath);

    await assert.rejects(
      async () => {
        await registry.saveToFile();
      },
      /No file path provided/
    );
  });
});

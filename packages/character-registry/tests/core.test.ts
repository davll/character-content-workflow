import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { CharacterRegistry } from '../src/index.ts';

const ROOT_PATH = path.resolve('registry-root');

describe('CharacterRegistry core', () => {
  test('loads valid data and merges group/sheet prompt building', () => {
    const registry = CharacterRegistry.fromData(ROOT_PATH, {
      characters: {
        mike: {
          names: ['Mike'],
          characteristics: ['tall', 'red hair'],
        },
        hiroshi: {
          names: ['Hiroshi'],
        },
      },
      groups: {
        mike_and_hiroshi: {
          characters: ['mike', 'hiroshi'],
          prompt_building: {
            descriptions: {
              style: ['anime'],
              global: ['high quality'],
            },
            constraints: ['height ratio 1.5:1'],
            system_instructions: ['instruction 1'],
          },
          sheets: {
            suit: {
              path: 'path/to/suit.png',
              summary: 'Suit outfit',
              prompt_building: {
                descriptions: {
                  style: ['realistic'],
                  outfit: ['black suit'],
                },
                constraints: ['no ties'],
                system_instructions: ['instruction 2'],
              },
            },
          },
        },
      },
    });
    const mike = registry.getCharacter('mike');
    const merged = registry.getGroupSheetPromptBuilding('mike_and_hiroshi', 'suit');

    assert.equal(mike?.names[0], 'Mike');
    assert.equal(mike?.characteristics?.[0], 'tall');
    assert.ok(merged);
    assert.deepEqual(merged.descriptions.style, ['anime', 'realistic']);
    assert.equal(merged.descriptions.global[0], 'high quality');
    assert.equal(merged.descriptions.outfit[0], 'black suit');
    assert.equal(merged.constraints.length, 2);
    assert.equal(merged.system_instructions.length, 2);
  });

  test('returns compact character inference info', () => {
    const registry = CharacterRegistry.fromData(ROOT_PATH, {
      characters: {
        mike: { names: ['Mike'] },
        hiroshi: { names: ['Hiroshi'] },
      },
      groups: {
        mike_and_hiroshi: {
          characters: ['mike', 'hiroshi'],
          sheets: {
            suit: { path: 'suit.png', summary: 'Suit outfit' },
          },
        },
      },
    });
    const info = registry.getCharacterInferenceInfo();

    assert.equal(info.characters.length, 2);
    assert.equal(info.groups.length, 1);
    assert.equal(info.groups[0].sheets[0].id, 'suit');
    assert.equal(info.groups[0].sheets[0].summary, 'Suit outfit');
  });

  test('rejects invalid schema data', () => {
    assert.throws(
      () => {
        CharacterRegistry.fromData(ROOT_PATH, {
          characters: {
            mike: { names: ['Mike'] },
          },
          groups: {
            g1: {
              characters: ['mike'],
              sheets: {
                s1: { path: 'p1' },
              },
            },
          },
        });
      },
      { name: 'ZodError' }
    );
  });

  test('rejects legacy prompt building segments', () => {
    assert.throws(
      () => {
        CharacterRegistry.fromData(ROOT_PATH, {
          characters: {
            mike: { names: ['Mike'] },
          },
          groups: {
            g1: {
              characters: ['mike'],
              prompt_building: {
                segments: {
                  style: ['legacy group style'],
                },
              },
              sheets: {
                s1: { path: 'p1', summary: 'd1' },
              },
            },
          },
        });
      },
      { name: 'ZodError' }
    );
  });

  test('rejects legacy sheet description', () => {
    assert.throws(
      () => {
        CharacterRegistry.fromData(ROOT_PATH, {
          characters: {
            mike: { names: ['Mike'] },
          },
          groups: {
            g1: {
              characters: ['mike'],
              sheets: {
                s1: { path: 'p1', description: 'legacy sheet description' },
              },
            },
          },
        });
      },
      { name: 'ZodError' }
    );
  });

  test('returns undefined for non-existent IDs', () => {
    const registry = CharacterRegistry.fromData(ROOT_PATH, {
      characters: {
        mike: { names: ['Mike'] },
      },
      groups: {
        g1: {
          characters: ['mike'],
          sheets: {
            s1: { path: 'p1', summary: 'd1' },
          },
        },
      },
    });

    assert.equal(registry.getCharacter('ghost'), undefined);
    assert.equal(registry.getGroup('ghost'), undefined);
    assert.equal(registry.getGroupSheets('ghost'), undefined);
    assert.equal(registry.getGroupSheetPath('g1', 'ghost'), undefined);
    assert.equal(registry.getGroupSheetPath('ghost', 'ghost'), undefined);
    assert.equal(registry.getGroupSheetPromptBuilding('ghost', 'ghost'), undefined);
    assert.equal(registry.getGroupSheetCombinedPromptBuildingInfo('ghost', 'ghost'), undefined);
  });

  test('returns getters, resolved sheet paths, and combined prompt info', () => {
    const registry = CharacterRegistry.fromData(ROOT_PATH, {
      characters: {
        mike: { names: ['Mike'] },
      },
      groups: {
        g1: {
          characters: ['mike'],
          sheets: {
            s1: { path: 'img.png', summary: 'desc' },
          },
        },
      },
    });
    const resolvedPath = registry.getGroupSheetPath('g1', 's1');
    const combined = registry.getGroupSheetCombinedPromptBuildingInfo('g1', 's1');

    assert.ok(registry.getAllCharacters().mike);
    assert.ok(registry.getAllGroups().g1);
    assert.ok(registry.getGroupSheets('g1')?.s1);
    assert.ok(resolvedPath?.endsWith('img.png'));
    assert.ok(path.isAbsolute(resolvedPath!));
    assert.equal(combined?.summary, 'desc');
  });

  test('returns empty prompt building defaults when group and sheet omit them', () => {
    const registry = CharacterRegistry.fromData(ROOT_PATH, {
      characters: {
        mike: { names: ['Mike'] },
      },
      groups: {
        g1: {
          characters: ['mike'],
          sheets: {
            s1: { path: 'p1', summary: 'd1' },
          },
        },
      },
    });
    const merged = registry.getGroupSheetPromptBuilding('g1', 's1');

    assert.ok(merged);
    assert.deepEqual(merged.descriptions, {});
    assert.deepEqual(merged.constraints, []);
    assert.deepEqual(merged.system_instructions, []);
  });

  test('returns a cloned data snapshot', () => {
    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('new_char', { names: ['New Character'], characteristics: ['cool'] });
    registry.addGroup('new_group', { characters: ['new_char'], prompt_building: { descriptions: {}, constraints: [], system_instructions: [] } });
    registry.addSheetToGroup('new_group', 'new_sheet', { path: 'new.png', summary: 'New Sheet' });

    const data = registry.toData();
    data.characters.new_char.names[0] = 'Mutated';

    assert.equal(registry.getCharacter('new_char')?.names[0], 'New Character');
    assert.equal(data.groups.new_group.sheets.new_sheet.path, 'new.png');
  });

  test('empty creates an editable registry without file I/O', () => {
    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('mike', { names: ['Mike'] });

    assert.equal(registry.rootPath, ROOT_PATH);
    assert.equal(registry.getCharacter('mike')?.names[0], 'Mike');
  });
});

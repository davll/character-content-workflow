import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { CharacterRegistry } from '../src/index.ts';

const ROOT_PATH = path.resolve('registry-root');

describe('CharacterRegistry validation', () => {
  test('rejects groups that reference missing characters', () => {
    assert.throws(
      () => {
        CharacterRegistry.fromData(ROOT_PATH, {
          characters: {
            mike: { names: ['Mike'] },
          },
          groups: {
            g1: {
              characters: ['mike', 'ghost'],
              sheets: {},
            },
          },
        });
      },
      /references missing character "ghost"/
    );
  });

  test('rejects unsafe sheet paths', () => {
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
                s1: { path: '../outside.png', summary: 'bad' },
              },
            },
          },
        });
      },
      /path must stay inside the registry root/
    );

    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });

    assert.throws(
      () => {
        registry.addSheetToGroup('g1', 's1', { path: path.resolve(ROOT_PATH, 'absolute.png'), summary: 'bad' });
      },
      /path must be relative/
    );
  });

  test('rejects unsafe IDs', () => {
    assert.throws(
      () => {
        CharacterRegistry.fromData(ROOT_PATH, {
          characters: {
            mike: { names: ['Mike'] },
          },
          groups: {
            '../outside': {
              characters: ['mike'],
              sheets: {},
            },
          },
        });
      },
      /IDs may only contain/
    );

    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('mike', { names: ['Mike'] });

    assert.throws(
      () => {
        registry.addGroup('../outside', { characters: ['mike'] });
      },
      /IDs may only contain/
    );
  });

  test('getters do not expose mutable registry state', () => {
    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });
    registry.addSheetToGroup('g1', 's1', { path: 'img.png', summary: 'desc' });

    registry.getAllCharacters().mike.names[0] = 'Mutated';
    registry.getAllGroups().g1.characters.push('ghost');
    registry.getCharacter('mike')!.names[0] = 'Mutated again';
    registry.getGroup('g1')!.sheets.s1.summary = 'changed';
    registry.getGroupSheets('g1')!.s1.summary = 'changed again';

    assert.equal(registry.getCharacter('mike')?.names[0], 'Mike');
    assert.deepEqual(registry.getGroup('g1')?.characters, ['mike']);
    assert.equal(registry.getGroupSheets('g1')?.s1.summary, 'desc');
  });

  test('failed group mutation does not change registry state', () => {
    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('mike', { names: ['Mike'] });

    assert.throws(
      () => {
        registry.addGroup('g1', { characters: ['ghost'] });
      },
      /references missing character "ghost"/
    );

    assert.equal(registry.getGroup('g1'), undefined);
    assert.deepEqual(registry.toData(), {
      characters: {
        mike: {
          names: ['Mike'],
          characteristics: [],
        },
      },
      groups: {},
    });
  });

  test('failed sheet mutation does not change registry state', () => {
    const registry = CharacterRegistry.empty(ROOT_PATH);
    registry.addCharacter('mike', { names: ['Mike'] });
    registry.addGroup('g1', { characters: ['mike'] });

    assert.throws(
      () => {
        registry.addSheetToGroup('g1', 's1', { path: '../outside.png', summary: 'bad' });
      },
      /path must stay inside the registry root/
    );

    assert.deepEqual(registry.getGroupSheets('g1'), {});
  });
});

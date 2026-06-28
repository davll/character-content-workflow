import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { StyleRegistry } from '../src/index.ts';

const ROOT_PATH = path.resolve('registry-root');

describe('StyleRegistry', () => {
  test('rejects non-snake-case style IDs', () => {
    assert.throws(
      () => {
        StyleRegistry.fromData(ROOT_PATH, {
          styles: {
            PaperCraft: {
              names: ['paper craft'],
              summary: 'bad id',
            },
          },
        });
      },
      /lowercase snake_case/
    );
  });

  test('returns inference summaries without prompt-building data', () => {
    const registry = StyleRegistry.fromData(ROOT_PATH, {
      styles: {
        paper_craft: {
          names: ['paper craft'],
          summary: 'Soft cute layered paper craft style.',
          prompt_building: {
            descriptions: {
              rendering: ['Layered cut-paper construction.'],
            },
          },
        },
      },
    });

    assert.deepEqual(registry.getStyleSummaries(), {
      styles: [
        {
          id: 'paper_craft',
          names: ['paper craft'],
          summary: 'Soft cute layered paper craft style.',
        },
      ],
    });
  });

  test('getStylePromptBuildingInfo returns cloned prompt-building data', () => {
    const registry = StyleRegistry.fromData(ROOT_PATH, {
      styles: {
        paper_craft: {
          names: ['paper craft'],
          summary: 'Soft cute layered paper craft style.',
          prompt_building: {
            descriptions: {
              rendering: ['Layered cut-paper construction.'],
            },
            constraints: ['Preserve identity.'],
            system_instructions: ['Apply after character constraints.'],
          },
        },
      },
    });

    const info = registry.getStylePromptBuildingInfo('paper_craft')!;
    info.prompt_building.descriptions.rendering[0] = 'mutated';

    assert.equal(
      registry.getStylePromptBuildingInfo('paper_craft')!.prompt_building.descriptions.rendering[0],
      'Layered cut-paper construction.',
    );
  });
});

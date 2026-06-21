#!/usr/bin/env node --experimental-strip-types
import { Command } from 'commander';
import { CharacterRegistry } from './index.ts';
import yaml from 'js-yaml';
import { exit } from 'process';

const program = new Command();

program
  .name('character-registry')
  .description('CLI for querying character and group settings')
  .version('1.0.0');

const DEFAULT_YAML_PATH = 'characters/index.yaml';

program.command('validate')
  .description('Validate that a character registry YAML file matches the registry schema and safety rules')
  .option('-f, --file <path>', 'Path to characters index.yaml', DEFAULT_YAML_PATH)
  .action(async (options) => {
    await runCommand(async () => {
      await CharacterRegistry.loadFromFile(options.file);
      console.log(`Valid character registry: ${options.file}`);
    });
  });

program.command('list-all')
  .description('List all characters and group summaries for scene/character inference stage')
  .option('-f, --file <path>', 'Path to characters index.yaml', DEFAULT_YAML_PATH)
  .action(async (options) => {
    await runCommand(async () => {
      const registry = await CharacterRegistry.loadFromFile(options.file);
      const info = registry.getCharacterInferenceInfo();
      console.log(yaml.dump(info, { indent: 2, lineWidth: -1, }));
    });
  });

program.command('get-sheet-info')
  .description('Get the detailed information of the selected character sheet for prompt building')
  .option('-f, --file <path>', 'Path to characters index.yaml', DEFAULT_YAML_PATH)
  .argument('<groupId>', 'Group ID of the selected character sheet')
  .argument('<sheetId>', 'Sheet ID of the selected character sheet')
  .action(async (groupId, sheetId, options) => {
    await runCommand(async () => {
      const registry = await CharacterRegistry.loadFromFile(options.file);
      const info = registry.getGroupSheetCombinedPromptBuildingInfo(groupId, sheetId);
      if (!info) {
        throw new Error(`no valid character sheet of ${groupId}:${sheetId}`);
      }
      console.log(yaml.dump(info, { indent: 2, lineWidth: -1, }));
    });
  });

program.command('get-sheet-path')
  .description('Get the resolved path of the selected character sheet for image generation')
  .option('-f, --file <path>', 'Path to characters index.yaml', DEFAULT_YAML_PATH)
  .argument('<groupId>', 'Group ID of the selected character sheet')
  .argument('<sheetId>', 'Sheet ID of the selected character sheet')
  .action(async (groupId, sheetId, options) => {
    await runCommand(async () => {
      const registry = await CharacterRegistry.loadFromFile(options.file);
      const sheetPath = registry.getGroupSheetPath(groupId, sheetId);
      if (!sheetPath) {
        throw new Error(`no valid character sheet of ${groupId}:${sheetId}`);
      }
      console.log(sheetPath);
    });
  });

program.parse(process.argv);

async function runCommand(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    exit(1);
  }
}

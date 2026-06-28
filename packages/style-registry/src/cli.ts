#!/usr/bin/env node --experimental-strip-types
import { Command } from 'commander';
import yaml from 'js-yaml';
import { exit } from 'process';
import { StyleRegistry } from './index.ts';

const program = new Command();

program
  .name('style-registry')
  .description('CLI for querying visual style prompt-building profiles')
  .version('1.0.0');

const DEFAULT_YAML_PATH = 'styles/index.yaml';

program.command('validate')
  .description('Validate that a style registry YAML file matches the registry schema')
  .option('-f, --file <path>', 'Path to styles index.yaml', DEFAULT_YAML_PATH)
  .action(async (options) => {
    await runCommand(async () => {
      await StyleRegistry.loadFromFile(options.file);
      console.log(`Valid style registry: ${options.file}`);
    });
  });

program.command('list-all')
  .description('List style summaries for scene/style inference stage')
  .option('-f, --file <path>', 'Path to styles index.yaml', DEFAULT_YAML_PATH)
  .action(async (options) => {
    await runCommand(async () => {
      const registry = await StyleRegistry.loadFromFile(options.file);
      console.log(yaml.dump(registry.getStyleSummaries(), { indent: 2, lineWidth: -1 }));
    });
  });

program.command('get-style-info')
  .description('Get detailed style prompt-building information')
  .option('-f, --file <path>', 'Path to styles index.yaml', DEFAULT_YAML_PATH)
  .argument('<styleId>', 'Style ID to load')
  .action(async (styleId, options) => {
    await runCommand(async () => {
      const registry = await StyleRegistry.loadFromFile(options.file);
      const info = registry.getStylePromptBuildingInfo(styleId);
      if (!info) {
        throw new Error(`no valid style profile ${styleId}`);
      }
      console.log(yaml.dump(info, { indent: 2, lineWidth: -1 }));
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

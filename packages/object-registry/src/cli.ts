#!/usr/bin/env node --experimental-strip-types
import { Command } from 'commander';
import yaml from 'js-yaml';
import { exit } from 'process';
import { ObjectRegistry } from './index.ts';

const program = new Command();

program
  .name('object-registry')
  .description('CLI for querying reusable object and prop registry data')
  .version('1.0.0');

const DEFAULT_YAML_PATH = 'objects/index.yaml';

program.command('validate')
  .description('Validate that an object registry YAML file matches the registry schema and safety rules')
  .option('-f, --file <path>', 'Path to objects index.yaml', DEFAULT_YAML_PATH)
  .action(async (options) => {
    await runCommand(async () => {
      await ObjectRegistry.loadFromFile(options.file);
      console.log(`Valid object registry: ${options.file}`);
    });
  });

program.command('list-all')
  .description('List searchable object summaries for scene/object inference')
  .option('-f, --file <path>', 'Path to objects index.yaml', DEFAULT_YAML_PATH)
  .action(async (options) => {
    await runCommand(async () => {
      const registry = await ObjectRegistry.loadFromFile(options.file);
      console.log(yaml.dump({ objects: registry.listObjects() }, { indent: 2, lineWidth: -1 }));
    });
  });

program.command('search')
  .description('Search object aliases, categories, subtypes, summaries, and usage profile names')
  .option('-f, --file <path>', 'Path to objects index.yaml', DEFAULT_YAML_PATH)
  .argument('<query>', 'Object search query')
  .action(async (query, options) => {
    await runCommand(async () => {
      const registry = await ObjectRegistry.loadFromFile(options.file);
      console.log(yaml.dump({ objects: registry.searchObjects(query) }, { indent: 2, lineWidth: -1 }));
    });
  });

program.command('get-object-info')
  .description('Get detailed object prompt-building data')
  .option('-f, --file <path>', 'Path to objects index.yaml', DEFAULT_YAML_PATH)
  .argument('<objectId>', 'Object ID')
  .action(async (objectId, options) => {
    await runCommand(async () => {
      const registry = await ObjectRegistry.loadFromFile(options.file);
      const info = registry.getObjectInfo(objectId);
      if (!info) {
        throw new Error(`no valid object: ${objectId}`);
      }
      console.log(yaml.dump(info, { indent: 2, lineWidth: -1 }));
    });
  });

program.command('get-reference-path')
  .description('Get the resolved path of an object reference image for image generation')
  .option('-f, --file <path>', 'Path to objects index.yaml', DEFAULT_YAML_PATH)
  .argument('<objectId>', 'Object ID')
  .argument('<referenceId>', 'Reference image ID')
  .action(async (objectId, referenceId, options) => {
    await runCommand(async () => {
      const registry = await ObjectRegistry.loadFromFile(options.file);
      const referencePath = registry.getReferencePath(objectId, referenceId);
      if (!referencePath) {
        throw new Error(`no valid object reference: ${objectId}:${referenceId}`);
      }
      console.log(referencePath);
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

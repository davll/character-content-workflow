import { Command } from 'commander';
import { getDefaultApiKeyEnv, listModels } from './providers.ts';
import { runGenerateImage } from './runner.ts';
import type { GenerateImageOptions } from './types.ts';

export async function main(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('generate-image')
    .description('Repository-local CLI for generating images via OpenAI or xAI')
    .version('1.0.0');

  program
    .command('gen')
    .description('Generate an image')
    .option('-o, --output <path>', 'Output image path')
    .option('--metadata <path>', 'Optional metadata JSON output path')
    .option('--prompt-file <path>', 'Path to the text file containing the prompt')
    .option('--prompt-text <text>', 'Inline prompt text')
    .option('-p, --provider <provider>', 'API provider (openai, xai)', 'openai')
    .option('-m, --model <model>', 'Specific model ID')
    .option('-c, --count <number>', 'Number of images to generate', parseInt)
    .option('-s, --size <size>', 'Image size (e.g. 1024x1024)')
    .option('-q, --quality <quality>', 'Image quality (low, medium, high, auto for gpt-image; standard, hd for dall-e)')
    .option('--aspect-ratio <ratio>', 'Aspect ratio (e.g. 1:1, 16:9)')
    .option('--resolution <res>', 'Resolution (e.g. 1024x1024)')
    .option('--api-key-env <name>', 'Environment variable name containing the API key')
    .option('--moderation <level>', 'Content moderation level (auto, low) [OpenAI only]', 'auto')
    .option('-r, --reference <paths...>', 'Paths to reference images for editing')
    .option('--dry-run', 'Validate inputs without calling the image generation API', false)
    .option('-v, --verbose', 'Print verbose output', false)
    .option('-f, --force', 'Overwrite existing output file', false)
    .action(async (options) => {
      const genOptions: GenerateImageOptions = {
        provider: options.provider,
        model: options.model,
        count: options.count,
        outputPath: options.output,
        metadataPath: options.metadata,
        promptFilePath: options.promptFile,
        promptText: options.promptText,
        referenceImagePaths: options.reference,
        force: options.force,
        size: options.size,
        quality: options.quality,
        aspectRatio: options.aspectRatio,
        resolution: options.resolution,
        moderation: options.moderation,
        apiKey: readApiKeyFromEnv(options.apiKeyEnv ?? getDefaultApiKeyEnv(options.provider)),
        verbose: options.verbose,
        dryRun: options.dryRun,
      };

      try {
        console.log(`Generating image using ${options.provider}...`);
        const result = await runGenerateImage(genOptions);
        console.log(result.message);
      } catch (error) {
        printErrorAndExit(error);
      }
    });

  program
    .command('models')
    .description('List available image models for a provider')
    .option('-p, --provider <provider>', 'API provider (openai, xai)', 'openai')
    .option('--api-key-env <name>', 'Environment variable name containing the API key')
    .option('-v, --verbose', 'Print verbose output', false)
    .action(async (options) => {
      try {
        console.log(`Listing available models for ${options.provider}...`);
        const models = await listModels(
          options.provider,
          readApiKeyFromEnv(options.apiKeyEnv ?? getDefaultApiKeyEnv(options.provider)),
          options.verbose,
        );
        if (models.length === 0) {
          console.log('No matching image models found.');
        } else {
          models.forEach((m) => console.log(` - ${m}`));
        }
      } catch (error) {
        printErrorAndExit(error);
      }
    });

  const parseArgv = [...argv];
  const isCommand = (arg: string) => ['gen', 'models', 'help'].includes(arg);
  const args = parseArgv.slice(2);

  if (args.length > 0 && !isCommand(args[0]) && args[0] !== '--help' && args[0] !== '-h') {
    parseArgv.splice(2, 0, 'gen');
  }

  await program.parseAsync(parseArgv);
}

function readApiKeyFromEnv(envName: string): string | undefined {
  const value = process.env[envName];
  return value && value.trim() ? value.trim() : undefined;
}

function printErrorAndExit(error: unknown): never {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error(`Error: ${String(error)}`);
  }
  process.exit(1);
}

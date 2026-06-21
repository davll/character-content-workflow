import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(workspaceRoot);

const entryPoint = path.join(workspaceRoot, 'packages/generate-image/src/main.ts');
const distDir = path.join(workspaceRoot, 'dist');
const distFile = path.join(distDir, 'generate-image.mjs');
const skillFile = path.join(repoRoot, 'skills/image-generation/scripts/generate-image.mjs');

await mkdir(distDir, { recursive: true });
await build({
  entryPoints: [entryPoint],
  outfile: distFile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  logLevel: 'info',
});

await mkdir(path.dirname(skillFile), { recursive: true });
await copyFile(distFile, skillFile);

console.log(`Wrote bundled CLI: ${distFile}`);
console.log(`Updated skill CLI: ${skillFile}`);

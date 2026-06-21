import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(workspaceRoot, 'skills');
const targetRoot = path.join(workspaceRoot, '.agents', 'skills');

await mkdir(targetRoot, { recursive: true });

const entries = await readdir(sourceRoot, { withFileTypes: true });
const skillDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

for (const skillName of skillDirs) {
  const sourceDir = path.join(sourceRoot, skillName);
  const targetDir = path.join(targetRoot, skillName);
  const sourceSkill = path.join(sourceDir, 'SKILL.md');

  if (!(await existsFile(sourceSkill))) {
    continue;
  }

  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
  console.log(`Synced ${path.relative(workspaceRoot, sourceDir)} -> ${path.relative(workspaceRoot, targetDir)}`);
}

async function existsFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

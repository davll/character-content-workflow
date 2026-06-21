import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { TestContext } from 'node:test';

export interface FileTestWorkspace {
  rootPath: string;
  yamlPath: string;
  sourceImagePath: string;
}

export async function createFileTestWorkspace(t: TestContext): Promise<FileTestWorkspace> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'character-registry-'));
  t.after(async () => {
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  return {
    rootPath,
    yamlPath: path.join(rootPath, 'index.yaml'),
    sourceImagePath: path.join(rootPath, 'source.png'),
  };
}

export async function writeRegistryYaml(workspace: FileTestWorkspace, content: string): Promise<void> {
  await fs.writeFile(workspace.yamlPath, content, 'utf8');
}

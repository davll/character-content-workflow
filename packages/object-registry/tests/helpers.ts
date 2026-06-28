import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { TestContext } from 'node:test';

export interface FileTestWorkspace {
  rootPath: string;
  yamlPath: string;
  pngPath: string;
  textPath: string;
}

export async function createFileTestWorkspace(t: TestContext): Promise<FileTestWorkspace> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'object-registry-'));
  t.after(async () => {
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  const pngPath = path.join(rootPath, 'references', 'fixture.png');
  const textPath = path.join(rootPath, 'references', 'not-image.png');
  await fs.mkdir(path.dirname(pngPath), { recursive: true });
  await fs.writeFile(pngPath, tinyPngBytes());
  await fs.writeFile(textPath, 'not an image', 'utf8');

  return {
    rootPath,
    yamlPath: path.join(rootPath, 'index.yaml'),
    pngPath,
    textPath,
  };
}

export async function writeRegistryYaml(workspace: FileTestWorkspace, content: string): Promise<void> {
  await fs.writeFile(workspace.yamlPath, content, 'utf8');
}

export function validRegistryYaml(overrides = ''): string {
  return `
objects:
  vintage_rangefinder:
    names:
      - Vintage 35mm rangefinder
      - Compact rangefinder camera
    category: camera
    subtype: 35mm rangefinder
    summary: Compact vintage-style 35mm rangefinder camera.
    visual_traits:
      - compact silver-and-black metal rangefinder body
      - small lens
      - flat top plate with a slim viewfinder window
    accessories:
      - thin neck or wrist strap
    usage_profiles:
      carrying:
        - held one-handed at waist or chest height
      shooting:
        - raised to one eye with compact rangefinder grip
    constraints:
      - Keep the body compact, flat-topped, and lighter in handling than a larger SLR.
    reference_images:
      - id: front_angle
        path: references/fixture.png
        role: object_design
        prompt_usage: Use only for compact rangefinder body shape and rangefinder details.
${overrides}`;
}

function tinyPngBytes(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89,
  ]);
}

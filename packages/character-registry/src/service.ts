import fs from 'fs/promises';
import path from 'path';
import { CharacterRegistry } from './index.ts';
import { GroupIdSchema, SheetIdSchema, SheetSchema } from './types.ts';
import type {
  PromptBuilding,
  CharacterId,
  GroupId,
  SheetId,
} from './types.ts';

type CharacterInput = Parameters<CharacterRegistry['addCharacter']>[1];

export type SheetAttachData = {
  path?: string;
  description: string;
  prompt_building?: PromptBuilding;
};

export class CharacterRegistryService {
  private registry: CharacterRegistry;

  constructor(registry: CharacterRegistry) {
    this.registry = registry;
  }

  /**
   * Add or update a character in the registry.
   */
  async upsertCharacter(id: CharacterId, data: CharacterInput): Promise<void> {
    this.registry.addCharacter(id, data);
  }

  /**
   * Add or update a group in the registry.
   * Sheets are preserved if the group already exists.
   */
  async upsertGroup(id: GroupId, data: { characters: CharacterId[]; prompt_building?: PromptBuilding }): Promise<void> {
    this.registry.addGroup(id, data);
  }

  /**
   * Attach a sheet to a group. 
   * If sourceImagePath is provided, it copies the image to the standardized
   * group assets folder and updates the sheet's path automatically.
   */
  async attachSheet(
    groupId: GroupId,
    sheetId: SheetId,
    data: SheetAttachData,
    sourceImagePath?: string
  ): Promise<void> {
    GroupIdSchema.parse(groupId);
    SheetIdSchema.parse(sheetId);

    const group = this.registry.getGroup(groupId);
    if (!group) {
      throw new Error(`Cannot attach sheet to non-existent group: ${groupId}`);
    }

    if (sourceImagePath) {
      const ext = await getSupportedImageExtension(sourceImagePath);
      const fileName = `${groupId}_${sheetId}${ext}`;
      const destDir = path.join(this.registry.rootPath, 'groups', groupId, 'sheets', 'outfits');
      const destPath = path.join(destDir, fileName);
      const sheet = SheetSchema.parse({
        ...data,
        path: path.relative(this.registry.rootPath, destPath).replace(/\\/g, '/'),
      });

      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(sourceImagePath, destPath);
      this.registry.addSheetToGroup(groupId, sheetId, sheet);
      return;
    }

    if (!data.path) {
      throw new Error(`Cannot attach sheet "${groupId}:${sheetId}" without a path or source image`);
    }

    const sheet = SheetSchema.parse({
      ...data,
      path: data.path,
    });
    this.registry.addSheetToGroup(groupId, sheetId, sheet);
  }

  /**
   * Persist all changes back to the YAML file.
   */
  async save(): Promise<void> {
    await this.registry.saveToFile();
  }

  /**
   * Get current registry info for LLM context.
   */
  getInferenceInfo() {
    return this.registry.getCharacterInferenceInfo();
  }
}

async function getSupportedImageExtension(sourceImagePath: string): Promise<string> {
  const bytes = await fs.readFile(sourceImagePath);
  const mimeType = sniffSupportedImageMimeType(bytes);
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  throw new Error(`Unsupported sheet image format: ${sourceImagePath}. Only JPEG and PNG are supported.`);
}

function sniffSupportedImageMimeType(data: Buffer): string | null {
  if (data.length < 4) return null;

  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png';
  }

  return null;
}

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { z } from 'zod';
import {
  CharacterSchema,
  CharacterIdSchema,
  GroupSchema,
  GroupIdSchema,
  SheetSchema,
  SheetIdSchema,
  CharacterRegistryDataSchema,
  PromptBuildingSchema,
} from './types.ts';
import type {
  CharacterRegistryData,
  CharacterId, GroupId, SheetId,
  Character, Group, Sheet,
  PromptBuilding,
  CharacterInferenceInfo,
  GroupSheetCombinedPromptBuildingInfo,
} from './types.ts';
export { CharacterRegistryService } from './service.ts';
export type { SheetAttachData } from './service.ts';
export {
  CharacterIdSchema,
  GroupIdSchema,
  SheetIdSchema,
  CharacterSchema,
  PromptBuildingSchema,
  SheetSchema,
  GroupSchema,
  CharacterRegistryDataSchema,
} from './types.ts';
export type {
  CharacterId,
  GroupId,
  SheetId,
  Character,
  PromptBuilding,
  Sheet,
  Group,
  CharacterRegistryData,
  CharacterInferenceInfo,
  GroupSheetCombinedPromptBuildingInfo,
} from './types.ts';

type CharacterInput = z.input<typeof CharacterSchema>;
type GroupInput = Omit<z.input<typeof GroupSchema>, 'sheets'>;
type PromptBuildingInput = z.input<typeof PromptBuildingSchema>;
type SheetInput = {
  path: string;
  summary: string;
  prompt_building?: PromptBuildingInput;
};

export class CharacterRegistry {
  public readonly rootPath: string;
  private data: CharacterRegistryData;
  private filePath?: string;

  private constructor(rootPath: string, data: CharacterRegistryData, filePath?: string) {
    this.rootPath = rootPath;
    this.data = data;
    this.filePath = filePath;
  }

  public static fromData(rootPath: string, data: unknown, filePath?: string): CharacterRegistry {
    const validatedData = CharacterRegistryDataSchema.parse(data);
    const resolvedRootPath = path.resolve(rootPath);
    validateRegistryData(resolvedRootPath, validatedData);
    return new CharacterRegistry(resolvedRootPath, validatedData, filePath);
  }

  public static empty(rootPath: string, filePath?: string): CharacterRegistry {
    return new CharacterRegistry(path.resolve(rootPath), { characters: {}, groups: {} }, filePath);
  }

  public static async loadFromFile(yamlPath: string): Promise<CharacterRegistry> {
    return loadCharacterRegistryFromFile(yamlPath);
  }

  public static async init(yamlPath: string): Promise<CharacterRegistry> {
    return CharacterRegistry.empty(path.dirname(yamlPath), yamlPath);
  }

  public toData(): CharacterRegistryData {
    return clone(this.data);
  }

  public getAllCharacters(): Record<CharacterId, Character> {
    return clone(this.data.characters);
  }

  public getAllGroups(): Record<GroupId, Group> {
    return clone(this.data.groups);
  }

  public getCharacter(id: CharacterId): Character | undefined {
    const character = this.data.characters[id];
    return character ? clone(character) : undefined;
  }

  public getGroup(id: GroupId): Group | undefined {
    const group = this.data.groups[id];
    return group ? clone(group) : undefined;
  }

  public getGroupSheets(groupId: GroupId): Record<SheetId, Sheet> | undefined {
    const group = this.data.groups[groupId];
    if (!group) return undefined;
    return clone(group.sheets);
  }

  public addCharacter(id: CharacterId, character: CharacterInput): void {
    CharacterIdSchema.parse(id);
    const nextData = clone(this.data);
    nextData.characters[id] = CharacterSchema.parse(character);
    validateRegistryData(this.rootPath, nextData);
    this.data = nextData;
  }

  public addGroup(id: GroupId, group: GroupInput): void {
    GroupIdSchema.parse(id);
    const nextData = clone(this.data);
    nextData.groups[id] = {
      ...GroupSchema.omit({ sheets: true }).parse(group),
      sheets: nextData.groups[id]?.sheets || {},
    };
    validateRegistryData(this.rootPath, nextData);
    this.data = nextData;
  }

  public addSheetToGroup(groupId: GroupId, sheetId: SheetId, sheet: SheetInput): void {
    GroupIdSchema.parse(groupId);
    SheetIdSchema.parse(sheetId);
    if (!this.data.groups[groupId]) {
      throw new Error(`Group ${groupId} not found`);
    }
    const nextData = clone(this.data);
    nextData.groups[groupId].sheets[sheetId] = SheetSchema.parse(sheet);
    validateRegistryData(this.rootPath, nextData);
    this.data = nextData;
  }

  public async saveToFile(yamlPath?: string): Promise<void> {
    const targetPath = yamlPath || this.filePath;
    if (!targetPath) {
      throw new Error('No file path provided for saving');
    }
    await saveCharacterRegistryToFile(this, targetPath);
  }

  // For Character Inference
  getCharacterInferenceInfo(): CharacterInferenceInfo {
    const characters = Object.entries(this.data.characters).
      map(([id, ch]) => ({ id, names: [...ch.names] }));
    const groups = Object.entries(this.data.groups).
      map(([id, grp]) => ({
        id,
        characters: [...grp.characters],
        sheets: Object.entries(grp.sheets).
          map(([id, sht]) => ({
            id,
            summary: sht.summary,
          })),
      }));
    
    return { characters, groups };
  }

  // For Image Generation
  getGroupSheetPath(groupId: GroupId, sheetId: SheetId): string | undefined {
    const sheetPath = this.getGroup(groupId)?.sheets[sheetId]?.path;
    return sheetPath ? path.resolve(this.rootPath, sheetPath) : undefined;
  }

  // For Prompt Building
  getGroupSheetPromptBuilding(groupId: GroupId, sheetId: SheetId): PromptBuilding | undefined {
    const group = this.getGroup(groupId);
    const sheet = group?.sheets[sheetId];
    if (!group || !sheet) return undefined;

    const mergedDescriptions = new Map<string, string[]>();

    const groupPromptBuilding = group.prompt_building;
    const sheetPromptBuilding = sheet.prompt_building;

    // Merge descriptions
    for (const [key, value] of Object.entries(groupPromptBuilding?.descriptions || {})) {
      const vals = value as string[];
      if (!mergedDescriptions.has(key)) {
        mergedDescriptions.set(key, [...vals]);
      } else {
        mergedDescriptions.get(key)!.push(...vals);
      }
    }
    for (const [key, value] of Object.entries(sheetPromptBuilding?.descriptions || {})) {
      const vals = value as string[];
      if (!mergedDescriptions.has(key)) {
        mergedDescriptions.set(key, [...vals]);
      } else {
        mergedDescriptions.get(key)!.push(...vals);
      }
    }

    // Merge constraints and system_instructions
    const constraints = (groupPromptBuilding?.constraints || []).concat(sheetPromptBuilding?.constraints || []);
    const system_instructions = (groupPromptBuilding?.system_instructions || []).concat(sheetPromptBuilding?.system_instructions || []);

    return {
      descriptions: Object.fromEntries(mergedDescriptions.entries()),
      constraints,
      system_instructions,
    };
  }

  getGroupSheetCombinedPromptBuildingInfo(groupId: GroupId, sheetId: SheetId): GroupSheetCombinedPromptBuildingInfo | undefined {
    const group = this.getGroup(groupId);
    const sheet = group?.sheets[sheetId];
    if (!group || !sheet) return undefined;

    return {
      characters: Array.from(group.characters),
      summary: sheet.summary,
      prompt_building: this.getGroupSheetPromptBuilding(groupId, sheetId)!,
    };
  }
}

export async function loadCharacterRegistryFromFile(yamlPath: string): Promise<CharacterRegistry> {
  const rootPath = path.resolve(path.dirname(yamlPath));
  const fileContents = await fs.readFile(yamlPath, 'utf8');
  return CharacterRegistry.fromData(rootPath, yaml.load(fileContents), yamlPath);
}

export async function saveCharacterRegistryToFile(registry: CharacterRegistry, yamlPath: string): Promise<void> {
  const yamlContent = yaml.dump(registry.toData(), { indent: 2, lineWidth: -1 });
  await fs.mkdir(path.dirname(yamlPath), { recursive: true });
  await fs.writeFile(yamlPath, yamlContent, 'utf8');
}

function validateRegistryData(rootPath: string, data: CharacterRegistryData): void {
  for (const [groupId, group] of Object.entries(data.groups)) {
    for (const characterId of group.characters) {
      if (!data.characters[characterId]) {
        throw new Error(`Group "${groupId}" references missing character "${characterId}"`);
      }
    }

    for (const [sheetId, sheet] of Object.entries(group.sheets)) {
      validateSheetPath(rootPath, groupId, sheetId, sheet.path);
    }
  }
}

function validateSheetPath(rootPath: string, groupId: string, sheetId: string, sheetPath: string): void {
  if (!sheetPath.trim()) {
    throw new Error(`Sheet "${groupId}:${sheetId}" path must not be empty`);
  }

  if (path.isAbsolute(sheetPath)) {
    throw new Error(`Sheet "${groupId}:${sheetId}" path must be relative to the registry root`);
  }

  const resolvedRoot = path.resolve(rootPath);
  const resolvedSheetPath = path.resolve(resolvedRoot, sheetPath);
  const relativePath = path.relative(resolvedRoot, resolvedSheetPath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Sheet "${groupId}:${sheetId}" path must stay inside the registry root`);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

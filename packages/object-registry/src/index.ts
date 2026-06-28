import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import type { z } from 'zod';
import {
  ObjectEntrySchema,
  ObjectIdSchema,
  ObjectReferenceIdSchema,
  ObjectRegistryDataSchema,
} from './types.ts';
import type {
  ObjectEntry,
  ObjectId,
  ObjectListItem,
  ObjectPromptBuildingInfo,
  ObjectReferenceId,
  ObjectReferenceImage,
  ObjectRegistryData,
} from './types.ts';

export { ObjectRegistryService } from './service.ts';
export {
  ObjectCategorySchema,
  ObjectEntrySchema,
  ObjectIdSchema,
  ObjectReferenceIdSchema,
  ObjectReferenceImageSchema,
  ObjectRegistryDataSchema,
  UsageProfilesSchema,
} from './types.ts';
export type {
  ObjectCategory,
  ObjectEntry,
  ObjectId,
  ObjectListItem,
  ObjectPromptBuildingInfo,
  ObjectReferenceId,
  ObjectReferenceImage,
  ObjectReferenceInfo,
  ObjectRegistryData,
  UsageProfiles,
} from './types.ts';

type ObjectEntryInput = z.input<typeof ObjectEntrySchema>;

export class ObjectRegistry {
  public readonly rootPath: string;
  private data: ObjectRegistryData;
  private filePath?: string;

  private constructor(rootPath: string, data: ObjectRegistryData, filePath?: string) {
    this.rootPath = rootPath;
    this.data = data;
    this.filePath = filePath;
  }

  public static async fromData(rootPath: string, data: unknown, filePath?: string): Promise<ObjectRegistry> {
    const validatedData = ObjectRegistryDataSchema.parse(data);
    const resolvedRootPath = path.resolve(rootPath);
    await validateRegistryData(resolvedRootPath, validatedData);
    return new ObjectRegistry(resolvedRootPath, validatedData, filePath);
  }

  public static empty(rootPath: string, filePath?: string): ObjectRegistry {
    return new ObjectRegistry(path.resolve(rootPath), { objects: {} }, filePath);
  }

  public static async loadFromFile(yamlPath: string): Promise<ObjectRegistry> {
    return loadObjectRegistryFromFile(yamlPath);
  }

  public static init(yamlPath: string): ObjectRegistry {
    return ObjectRegistry.empty(path.dirname(yamlPath), yamlPath);
  }

  public toData(): ObjectRegistryData {
    return clone(this.data);
  }

  public getAllObjects(): Record<ObjectId, ObjectEntry> {
    return clone(this.data.objects);
  }

  public getObject(id: ObjectId): ObjectEntry | undefined {
    const object = this.data.objects[id];
    return object ? clone(object) : undefined;
  }

  public async addObject(id: ObjectId, object: ObjectEntryInput): Promise<void> {
    ObjectIdSchema.parse(id);
    const nextData = clone(this.data);
    nextData.objects[id] = ObjectEntrySchema.parse(object);
    await validateRegistryData(this.rootPath, nextData);
    this.data = nextData;
  }

  public async saveToFile(yamlPath?: string): Promise<void> {
    const targetPath = yamlPath || this.filePath;
    if (!targetPath) {
      throw new Error('No file path provided for saving');
    }
    await saveObjectRegistryToFile(this, targetPath);
  }

  public listObjects(): ObjectListItem[] {
    return Object.entries(this.data.objects).map(([id, object]) => ({
      id,
      names: [...object.names],
      category: object.category,
      subtype: object.subtype,
      summary: object.summary,
      usage_profiles: Object.keys(object.usage_profiles),
    }));
  }

  public searchObjects(query: string): ObjectListItem[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return [];

    return this.listObjects().filter((object) => {
      const fields = [
        object.id,
        ...object.names,
        object.category,
        object.subtype || '',
        object.summary,
        ...object.usage_profiles,
      ];
      return fields.some((field) => normalizeSearchText(field).includes(normalizedQuery));
    });
  }

  public getObjectInfo(objectId: ObjectId): ObjectPromptBuildingInfo | undefined {
    const object = this.getObject(objectId);
    if (!object) return undefined;

    return {
      id: objectId,
      names: object.names,
      category: object.category,
      subtype: object.subtype,
      summary: object.summary,
      visual_traits: object.visual_traits,
      accessories: object.accessories,
      usage_profiles: object.usage_profiles,
      constraints: object.constraints,
      reference_images: object.reference_images.map((reference) => ({
        ...reference,
        resolved_path: resolveReferencePath(this.rootPath, objectId, reference),
      })),
    };
  }

  public getReferencePath(objectId: ObjectId, referenceId: ObjectReferenceId): string | undefined {
    ObjectIdSchema.parse(objectId);
    ObjectReferenceIdSchema.parse(referenceId);
    const object = this.getObject(objectId);
    const reference = object?.reference_images.find((item) => item.id === referenceId);
    return reference ? resolveReferencePath(this.rootPath, objectId, reference) : undefined;
  }
}

export async function loadObjectRegistryFromFile(yamlPath: string): Promise<ObjectRegistry> {
  const rootPath = path.resolve(path.dirname(yamlPath));
  const fileContents = await fs.readFile(yamlPath, 'utf8');
  return ObjectRegistry.fromData(rootPath, yaml.load(fileContents), yamlPath);
}

export async function saveObjectRegistryToFile(registry: ObjectRegistry, yamlPath: string): Promise<void> {
  const yamlContent = yaml.dump(registry.toData(), { indent: 2, lineWidth: -1 });
  await fs.mkdir(path.dirname(yamlPath), { recursive: true });
  await fs.writeFile(yamlPath, yamlContent, 'utf8');
}

async function validateRegistryData(rootPath: string, data: ObjectRegistryData): Promise<void> {
  validateUniqueAliases(data);

  for (const [objectId, object] of Object.entries(data.objects)) {
    validateReferenceIds(objectId, object.reference_images);
    for (const reference of object.reference_images) {
      const resolvedPath = validateReferencePath(rootPath, objectId, reference);
      await validateSupportedImageFile(objectId, reference.id, resolvedPath);
    }
  }
}

function validateUniqueAliases(data: ObjectRegistryData): void {
  const seen = new Map<string, string>();

  for (const [objectId, object] of Object.entries(data.objects)) {
    for (const alias of object.names) {
      const normalizedAlias = normalizeAlias(alias);
      const existingObjectId = seen.get(normalizedAlias);
      if (existingObjectId && existingObjectId !== objectId) {
        throw new Error(`Duplicate object alias "${alias}" used by "${existingObjectId}" and "${objectId}"`);
      }
      seen.set(normalizedAlias, objectId);
    }
  }
}

function validateReferenceIds(objectId: string, references: ObjectReferenceImage[]): void {
  const seen = new Set<string>();
  for (const reference of references) {
    if (seen.has(reference.id)) {
      throw new Error(`Object "${objectId}" has duplicate reference image id "${reference.id}"`);
    }
    seen.add(reference.id);
  }
}

function validateReferencePath(rootPath: string, objectId: string, reference: ObjectReferenceImage): string {
  if (!reference.path.trim()) {
    throw new Error(`Object reference "${objectId}:${reference.id}" path must not be empty`);
  }

  if (path.isAbsolute(reference.path)) {
    throw new Error(`Object reference "${objectId}:${reference.id}" path must be relative to the registry root`);
  }

  const resolvedRoot = path.resolve(rootPath);
  const resolvedReferencePath = path.resolve(resolvedRoot, reference.path);
  const relativePath = path.relative(resolvedRoot, resolvedReferencePath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Object reference "${objectId}:${reference.id}" path must stay inside the registry root`);
  }

  return resolvedReferencePath;
}

function resolveReferencePath(rootPath: string, objectId: string, reference: ObjectReferenceImage): string {
  return validateReferencePath(rootPath, objectId, reference);
}

async function validateSupportedImageFile(objectId: string, referenceId: string, filePath: string): Promise<void> {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(filePath);
  } catch {
    throw new Error(`Object reference "${objectId}:${referenceId}" file does not exist: ${filePath}`);
  }

  const mimeType = sniffSupportedImageMimeType(bytes);
  if (!mimeType) {
    throw new Error(`Object reference "${objectId}:${referenceId}" must be a JPEG or PNG image by content signature`);
  }
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

function normalizeAlias(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

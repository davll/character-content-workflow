import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  StyleIdSchema,
  StyleProfileSchema,
  StyleRegistryDataSchema,
} from './types.ts';
import type {
  StyleId,
  StyleProfile,
  StylePromptBuildingInfo,
  StyleRegistryData,
  StyleSummary,
} from './types.ts';

export {
  StyleIdSchema,
  StyleProfileSchema,
  StylePromptBuildingSchema,
  StyleRegistryDataSchema,
} from './types.ts';
export type {
  StyleId,
  StyleProfile,
  StylePromptBuilding,
  StylePromptBuildingInfo,
  StyleRegistryData,
  StyleSummary,
} from './types.ts';

export class StyleRegistry {
  public readonly rootPath: string;
  private data: StyleRegistryData;
  private filePath?: string;

  private constructor(rootPath: string, data: StyleRegistryData, filePath?: string) {
    this.rootPath = rootPath;
    this.data = data;
    this.filePath = filePath;
  }

  public static fromData(rootPath: string, data: unknown, filePath?: string): StyleRegistry {
    const validatedData = StyleRegistryDataSchema.parse(data);
    return new StyleRegistry(path.resolve(rootPath), validatedData, filePath);
  }

  public static empty(rootPath: string, filePath?: string): StyleRegistry {
    return new StyleRegistry(path.resolve(rootPath), { styles: {} }, filePath);
  }

  public static async loadFromFile(yamlPath: string): Promise<StyleRegistry> {
    return loadStyleRegistryFromFile(yamlPath);
  }

  public static async init(yamlPath: string): Promise<StyleRegistry> {
    return StyleRegistry.empty(path.dirname(yamlPath), yamlPath);
  }

  public toData(): StyleRegistryData {
    return clone(this.data);
  }

  public getAllStyles(): Record<StyleId, StyleProfile> {
    return clone(this.data.styles);
  }

  public getStyle(id: StyleId): StyleProfile | undefined {
    const style = this.data.styles[id];
    return style ? clone(style) : undefined;
  }

  public addStyle(id: StyleId, style: StyleProfile): void {
    StyleIdSchema.parse(id);
    const nextData = clone(this.data);
    nextData.styles[id] = StyleProfileSchema.parse(style);
    this.data = StyleRegistryDataSchema.parse(nextData);
  }

  public getStyleSummaries(): { styles: StyleSummary[] } {
    return {
      styles: Object.entries(this.data.styles).map(([id, style]) => ({
        id,
        names: [...style.names],
        summary: style.summary,
      })),
    };
  }

  public getStylePromptBuildingInfo(styleId: StyleId): StylePromptBuildingInfo | undefined {
    const style = this.getStyle(styleId);
    if (!style) return undefined;
    return {
      id: styleId,
      names: [...style.names],
      summary: style.summary,
      prompt_building: clone(style.prompt_building),
    };
  }

  public async saveToFile(yamlPath?: string): Promise<void> {
    const targetPath = yamlPath || this.filePath;
    if (!targetPath) {
      throw new Error('No file path provided for saving');
    }
    await saveStyleRegistryToFile(this, targetPath);
  }
}

export async function loadStyleRegistryFromFile(yamlPath: string): Promise<StyleRegistry> {
  const rootPath = path.resolve(path.dirname(yamlPath));
  const fileContents = await fs.readFile(yamlPath, 'utf8');
  return StyleRegistry.fromData(rootPath, yaml.load(fileContents), yamlPath);
}

export async function saveStyleRegistryToFile(registry: StyleRegistry, yamlPath: string): Promise<void> {
  const yamlContent = yaml.dump(registry.toData(), { indent: 2, lineWidth: -1 });
  await fs.mkdir(path.dirname(yamlPath), { recursive: true });
  await fs.writeFile(yamlPath, yamlContent, 'utf8');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

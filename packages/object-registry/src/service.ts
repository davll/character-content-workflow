import type { ObjectRegistry } from './index.ts';
import type { ObjectEntry, ObjectId, ObjectListItem, ObjectPromptBuildingInfo, ObjectReferenceId } from './types.ts';

type ObjectInput = Parameters<ObjectRegistry['addObject']>[1];

export class ObjectRegistryService {
  private registry: ObjectRegistry;

  constructor(registry: ObjectRegistry) {
    this.registry = registry;
  }

  async upsertObject(id: ObjectId, data: ObjectInput): Promise<void> {
    await this.registry.addObject(id, data);
  }

  async save(): Promise<void> {
    await this.registry.saveToFile();
  }

  listObjects(): ObjectListItem[] {
    return this.registry.listObjects();
  }

  searchObjects(query: string): ObjectListItem[] {
    return this.registry.searchObjects(query);
  }

  getObject(id: ObjectId): ObjectEntry | undefined {
    return this.registry.getObject(id);
  }

  getObjectInfo(id: ObjectId): ObjectPromptBuildingInfo | undefined {
    return this.registry.getObjectInfo(id);
  }

  getReferencePath(objectId: ObjectId, referenceId: ObjectReferenceId): string | undefined {
    return this.registry.getReferencePath(objectId, referenceId);
  }
}

import { z } from 'zod';

const RegistryIdSchema = z.string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, 'IDs may only contain letters, numbers, "_" and "-"');

export const ObjectIdSchema = RegistryIdSchema;
export type ObjectId = z.infer<typeof ObjectIdSchema>;

export const ObjectReferenceIdSchema = RegistryIdSchema;
export type ObjectReferenceId = z.infer<typeof ObjectReferenceIdSchema>;

export const ObjectCategorySchema = z.enum([
  'camera',
  'weapon',
  'tool',
  'instrument',
  'bag',
  'vehicle',
  'accessory',
  'other',
]);
export type ObjectCategory = z.infer<typeof ObjectCategorySchema>;

export const ObjectReferenceImageSchema = z.object({
  id: ObjectReferenceIdSchema,
  path: z.string(),
  role: z.string().min(1),
  prompt_usage: z.string().min(1),
}).strict();
export type ObjectReferenceImage = z.infer<typeof ObjectReferenceImageSchema>;

export const UsageProfilesSchema = z.record(z.string(), z.array(z.string().min(1)));
export type UsageProfiles = z.infer<typeof UsageProfilesSchema>;

export const ObjectEntrySchema = z.object({
  names: z.array(z.string().min(1)).min(1),
  category: ObjectCategorySchema,
  subtype: z.string().optional(),
  summary: z.string().min(1),
  visual_traits: z.array(z.string().min(1)),
  accessories: z.array(z.string().min(1)).default([]),
  usage_profiles: UsageProfilesSchema,
  constraints: z.array(z.string().min(1)).default([]),
  reference_images: z.array(ObjectReferenceImageSchema).default([]),
}).strict();
export type ObjectEntry = z.infer<typeof ObjectEntrySchema>;

export const ObjectRegistryDataSchema = z.object({
  objects: z.record(ObjectIdSchema, ObjectEntrySchema),
}).strict();
export type ObjectRegistryData = z.infer<typeof ObjectRegistryDataSchema>;

export interface ObjectListItem {
  id: ObjectId;
  names: string[];
  category: ObjectCategory;
  subtype?: string;
  summary: string;
  usage_profiles: string[];
}

export interface ObjectReferenceInfo extends ObjectReferenceImage {
  resolved_path: string;
}

export interface ObjectPromptBuildingInfo {
  id: ObjectId;
  names: string[];
  category: ObjectCategory;
  subtype?: string;
  summary: string;
  visual_traits: string[];
  accessories: string[];
  usage_profiles: UsageProfiles;
  constraints: string[];
  reference_images: ObjectReferenceInfo[];
}

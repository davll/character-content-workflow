import { z } from 'zod';

const RegistryIdSchema = z.string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, 'IDs may only contain letters, numbers, "_" and "-"');

export const CharacterIdSchema = RegistryIdSchema;
export type CharacterId = z.infer<typeof CharacterIdSchema>;

export const GroupIdSchema = RegistryIdSchema;
export type GroupId = z.infer<typeof GroupIdSchema>;

export const SheetIdSchema = RegistryIdSchema;
export type SheetId = z.infer<typeof SheetIdSchema>;

export const CharacterSchema = z.object({
  names: z.array(z.string()),
  characteristics: z.array(z.string()).default([]),
});
export type Character = z.infer<typeof CharacterSchema>;

const DescriptionBucketsSchema = z.record(z.string(), z.array(z.string()));

export const PromptBuildingSchema = z.object({
  descriptions: DescriptionBucketsSchema.default({}),
  constraints: z.array(z.string()).default([]),
  system_instructions: z.array(z.string()).default([]),
}).strict();
export type PromptBuilding = z.infer<typeof PromptBuildingSchema>;

export const SheetSchema = z.object({
  path: z.string(),
  summary: z.string(),
  prompt_building: PromptBuildingSchema.default({
    descriptions: {},
    constraints: [],
    system_instructions: [],
  }),
}).strict();
export type Sheet = z.infer<typeof SheetSchema>;

export const GroupSchema = z.object({
  characters: z.array(CharacterIdSchema),
  sheets: z.record(SheetIdSchema, SheetSchema).default({}),
  prompt_building: PromptBuildingSchema.default({
    descriptions: {},
    constraints: [],
    system_instructions: [],
  }),
});
export type Group = z.infer<typeof GroupSchema>;

export const CharacterRegistryDataSchema = z.object({
  characters: z.record(CharacterIdSchema, CharacterSchema),
  groups: z.record(GroupIdSchema, GroupSchema),
});
export type CharacterRegistryData = z.infer<typeof CharacterRegistryDataSchema>;

export interface CharacterInferenceInfo {
  characters: { id: CharacterId, names: string[] }[];
  groups: { id: GroupId, characters: CharacterId[], sheets: { id: SheetId, summary: string }[] }[];
}

export interface GroupSheetCombinedPromptBuildingInfo {
  characters: CharacterId[];
  summary: string;
  prompt_building: PromptBuilding,
}

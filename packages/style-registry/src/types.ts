import { z } from 'zod';

export const StyleIdSchema = z.string()
  .min(1)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, 'Style IDs must be lowercase snake_case');
export type StyleId = z.infer<typeof StyleIdSchema>;

const DescriptionBucketsSchema = z.record(z.string(), z.array(z.string()));

export const StylePromptBuildingSchema = z.object({
  descriptions: DescriptionBucketsSchema.default({}),
  constraints: z.array(z.string()).default([]),
  system_instructions: z.array(z.string()).default([]),
}).strict();
export type StylePromptBuilding = z.infer<typeof StylePromptBuildingSchema>;

export const StyleProfileSchema = z.object({
  names: z.array(z.string()).min(1),
  summary: z.string().min(1),
  prompt_building: StylePromptBuildingSchema.default({
    descriptions: {},
    constraints: [],
    system_instructions: [],
  }),
}).strict();
export type StyleProfile = z.infer<typeof StyleProfileSchema>;

export const StyleRegistryDataSchema = z.object({
  styles: z.record(StyleIdSchema, StyleProfileSchema),
}).strict();
export type StyleRegistryData = z.infer<typeof StyleRegistryDataSchema>;

export interface StyleSummary {
  id: StyleId;
  names: string[];
  summary: string;
}

export interface StylePromptBuildingInfo extends StyleSummary {
  prompt_building: StylePromptBuilding;
}

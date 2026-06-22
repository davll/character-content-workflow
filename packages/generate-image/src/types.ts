export interface GenerateImageOptions {
  provider: string;
  model?: string;
  outputPath: string;
  metadataPath?: string;
  promptFilePath?: string;
  promptText?: string;
  referenceImagePaths?: string[];
  force?: boolean;
  count?: number;
  size?: string;
  quality?: string;
  aspectRatio?: string;
  resolution?: string;
  moderation?: string;
  apiKey?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface GenerateImageResult {
  status: 'generated' | 'skipped';
  message: string;
  outputPaths: string[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export type Logger = (msg: string) => void;

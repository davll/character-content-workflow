import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function loadDotEnv(filePath = '.env'): void {
  const resolvedPath = path.resolve(filePath);
  if (!existsSync(resolvedPath)) {
    return;
  }

  const content = readFileSync(resolvedPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = parseDotEnvValue(rawValue);
  }
}

function parseDotEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  const commentIndex = value.indexOf(' #');
  return (commentIndex === -1 ? value : value.slice(0, commentIndex)).trim();
}

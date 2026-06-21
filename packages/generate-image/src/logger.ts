import type { Logger } from './types.ts';

export function createLogger(verbose?: boolean): Logger {
  return (msg: string) => {
    if (verbose) {
      console.log(`[generate-image] ${msg}`);
    }
  };
}

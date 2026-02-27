/**
 * GCC Configuration System.
 *
 * Loads config from .gcc/config.json with sensible defaults.
 * v2: No LLM fields — agent writes summaries directly via MCP tools.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GCCConfig {
  recentCommitCount: number;
  milestonesKept: number;
  logMaxLines: number;
}

const DEFAULTS: GCCConfig = {
  recentCommitCount: 3,
  milestonesKept: 5,
  logMaxLines: 500,
};

/**
 * Load GCC config. Resolution order: .gcc/config.json > defaults.
 */
export function loadConfig(gccRoot: string): GCCConfig {
  const config = { ...DEFAULTS };

  const configPath = join(gccRoot, 'config.json');
  if (existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (typeof fileConfig.recentCommitCount === 'number') config.recentCommitCount = fileConfig.recentCommitCount;
      if (typeof fileConfig.milestonesKept === 'number') config.milestonesKept = fileConfig.milestonesKept;
      if (typeof fileConfig.logMaxLines === 'number') config.logMaxLines = fileConfig.logMaxLines;
    } catch {
      // Malformed config — use defaults
    }
  }

  return config;
}

/**
 * GCC Configuration System.
 *
 * Loads config from .gcc/config.json with env var overrides.
 * All values have sensible defaults — config file is optional.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GCCConfig {
  provider: string;
  model: string;
  cooldownSeconds: number;
  maxMessages: number;
  maxMessageLength: number;
  recentCommitCount: number;
  milestonesKept: number;
  autoExtract: boolean;
}

const DEFAULTS: GCCConfig = {
  provider: '',
  model: '',
  cooldownSeconds: 120,
  maxMessages: 30,
  maxMessageLength: 1000,
  recentCommitCount: 3,
  milestonesKept: 5,
  autoExtract: true,
};

/**
 * Load GCC config. Resolution order: env vars > .gcc/config.json > defaults.
 */
export function loadConfig(gccRoot: string): GCCConfig {
  const config = { ...DEFAULTS };

  // Load from config file if it exists
  const configPath = join(gccRoot, 'config.json');
  if (existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (typeof fileConfig.provider === 'string') config.provider = fileConfig.provider;
      if (typeof fileConfig.model === 'string') config.model = fileConfig.model;
      if (typeof fileConfig.cooldownSeconds === 'number') config.cooldownSeconds = fileConfig.cooldownSeconds;
      if (typeof fileConfig.maxMessages === 'number') config.maxMessages = fileConfig.maxMessages;
      if (typeof fileConfig.maxMessageLength === 'number') config.maxMessageLength = fileConfig.maxMessageLength;
      if (typeof fileConfig.recentCommitCount === 'number') config.recentCommitCount = fileConfig.recentCommitCount;
      if (typeof fileConfig.milestonesKept === 'number') config.milestonesKept = fileConfig.milestonesKept;
      if (typeof fileConfig.autoExtract === 'boolean') config.autoExtract = fileConfig.autoExtract;
    } catch {
      // Malformed config — use defaults
    }
  }

  // Env var overrides (highest priority)
  if (process.env.GCC_PROVIDER) config.provider = process.env.GCC_PROVIDER;
  if (process.env.GCC_MODEL) config.model = process.env.GCC_MODEL;
  if (process.env.GCC_COOLDOWN) {
    const parsed = parseInt(process.env.GCC_COOLDOWN, 10);
    if (!isNaN(parsed)) config.cooldownSeconds = parsed;
  }
  if (process.env.GCC_AUTO_EXTRACT === 'false') config.autoExtract = false;
  if (process.env.GCC_AUTO_EXTRACT === 'true') config.autoExtract = true;

  return config;
}

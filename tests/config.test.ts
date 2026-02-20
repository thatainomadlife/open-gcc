import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  const originalEnv = process.env;
  let testDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GCC_PROVIDER;
    delete process.env.GCC_MODEL;
    delete process.env.GCC_COOLDOWN;
    delete process.env.GCC_AUTO_EXTRACT;
    testDir = join(tmpdir(), `gcc-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const config = loadConfig(testDir);
    expect(config.cooldownSeconds).toBe(120);
    expect(config.maxMessages).toBe(30);
    expect(config.maxMessageLength).toBe(1000);
    expect(config.recentCommitCount).toBe(3);
    expect(config.milestonesKept).toBe(5);
    expect(config.autoExtract).toBe(true);
  });

  it('loads values from config.json', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      cooldownSeconds: 60,
      maxMessages: 50,
      milestonesKept: 10,
    }));

    const config = loadConfig(testDir);
    expect(config.cooldownSeconds).toBe(60);
    expect(config.maxMessages).toBe(50);
    expect(config.milestonesKept).toBe(10);
    // Non-specified values remain defaults
    expect(config.maxMessageLength).toBe(1000);
  });

  it('env vars override config file', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      cooldownSeconds: 60,
    }));
    process.env.GCC_COOLDOWN = '30';

    const config = loadConfig(testDir);
    expect(config.cooldownSeconds).toBe(30);
  });

  it('handles malformed config.json gracefully', () => {
    writeFileSync(join(testDir, 'config.json'), 'not json {{{');
    const config = loadConfig(testDir);
    expect(config.cooldownSeconds).toBe(120); // Falls back to defaults
  });

  it('respects GCC_AUTO_EXTRACT=false', () => {
    process.env.GCC_AUTO_EXTRACT = 'false';
    const config = loadConfig(testDir);
    expect(config.autoExtract).toBe(false);
  });

  it('respects GCC_AUTO_EXTRACT=true', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      autoExtract: false,
    }));
    process.env.GCC_AUTO_EXTRACT = 'true';
    const config = loadConfig(testDir);
    expect(config.autoExtract).toBe(true);
  });

  it('ignores invalid types in config file', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      cooldownSeconds: 'not-a-number',
      autoExtract: 'not-a-boolean',
    }));
    const config = loadConfig(testDir);
    expect(config.cooldownSeconds).toBe(120);
    expect(config.autoExtract).toBe(true);
  });
});

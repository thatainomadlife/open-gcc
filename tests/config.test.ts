import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `gcc-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const config = loadConfig(testDir);
    expect(config.recentCommitCount).toBe(3);
    expect(config.milestonesKept).toBe(5);
    expect(config.logMaxLines).toBe(500);
  });

  it('loads values from config.json', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      recentCommitCount: 10,
      milestonesKept: 10,
    }));

    const config = loadConfig(testDir);
    expect(config.recentCommitCount).toBe(10);
    expect(config.milestonesKept).toBe(10);
    expect(config.logMaxLines).toBe(500);
  });

  it('handles malformed config.json gracefully', () => {
    writeFileSync(join(testDir, 'config.json'), 'not json {{{');
    const config = loadConfig(testDir);
    expect(config.recentCommitCount).toBe(3);
  });

  it('ignores invalid types in config file', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      recentCommitCount: 'not-a-number',
      logMaxLines: true,
    }));
    const config = loadConfig(testDir);
    expect(config.recentCommitCount).toBe(3);
    expect(config.logMaxLines).toBe(500);
  });

  it('respects logMaxLines config', () => {
    writeFileSync(join(testDir, 'config.json'), JSON.stringify({
      logMaxLines: 1000,
    }));
    const config = loadConfig(testDir);
    expect(config.logMaxLines).toBe(1000);
  });
});

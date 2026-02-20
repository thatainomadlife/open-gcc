import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isOnCooldown, logError, getGCCRoot, getContextRoot } from '../src/util.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('isOnCooldown', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-cool-${Date.now()}`);
    mkdirSync(contextRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  it('returns false when no commits file', () => {
    expect(isOnCooldown(contextRoot)).toBe(false);
  });

  it('returns false when commits file has no timestamps', () => {
    writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n');
    expect(isOnCooldown(contextRoot)).toBe(false);
  });

  it('returns true when last commit is recent', () => {
    const now = new Date();
    const ts = now.toISOString().slice(0, 16).replace('T', ' ');
    writeFileSync(join(contextRoot, 'commits.md'),
      `# Milestone Journal\n\n## [C001] ${ts} | branch:main | Test\n`);
    expect(isOnCooldown(contextRoot, 120)).toBe(true);
  });

  it('returns false when last commit is old', () => {
    writeFileSync(join(contextRoot, 'commits.md'),
      '# Milestone Journal\n\n## [C001] 2020-01-01 12:00 | branch:main | Old\n');
    expect(isOnCooldown(contextRoot, 120)).toBe(false);
  });

  it('respects custom cooldown seconds', () => {
    // Format in local time to match how isOnCooldown parses (no timezone suffix = local)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${fiveMinAgo.getFullYear()}-${pad(fiveMinAgo.getMonth() + 1)}-${pad(fiveMinAgo.getDate())} ${pad(fiveMinAgo.getHours())}:${pad(fiveMinAgo.getMinutes())}`;
    writeFileSync(join(contextRoot, 'commits.md'),
      `# Milestone Journal\n\n## [C001] ${ts} | branch:main | Test\n`);
    // 600s cooldown (10 min) — should still be on cooldown
    expect(isOnCooldown(contextRoot, 600)).toBe(true);
    // 60s cooldown (1 min) — should be past cooldown
    expect(isOnCooldown(contextRoot, 60)).toBe(false);
  });
});

describe('logError', () => {
  let gccRoot: string;

  beforeEach(() => {
    gccRoot = join(tmpdir(), `gcc-err-${Date.now()}`);
    mkdirSync(gccRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(gccRoot, { recursive: true, force: true });
  });

  it('creates error.log if missing', () => {
    logError(gccRoot, 'test error');
    expect(existsSync(join(gccRoot, 'error.log'))).toBe(true);
  });

  it('logs error message with timestamp', () => {
    logError(gccRoot, new Error('something broke'));
    const content = readFileSync(join(gccRoot, 'error.log'), 'utf-8');
    expect(content).toContain('something broke');
    expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}/);
  });

  it('handles string errors', () => {
    logError(gccRoot, 'plain string error');
    const content = readFileSync(join(gccRoot, 'error.log'), 'utf-8');
    expect(content).toContain('plain string error');
  });

  it('rotates at 100 lines', () => {
    // Write 110 lines
    const lines = Array.from({ length: 110 }, (_, i) =>
      `[2026-01-01 00:00:00] Error ${i}\n`
    ).join('');
    writeFileSync(join(gccRoot, 'error.log'), lines);

    logError(gccRoot, 'trigger rotation');
    const content = readFileSync(join(gccRoot, 'error.log'), 'utf-8');
    const resultLines = content.split('\n').filter(Boolean);
    expect(resultLines.length).toBeLessThanOrEqual(51); // 50 kept + 1 new
  });
});

describe('getGCCRoot / getContextRoot', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLAUDE_PROJECT_DIR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses cwd when no CLAUDE_PROJECT_DIR', () => {
    expect(getGCCRoot('/home/user/project')).toBe('/home/user/project/.gcc');
    expect(getContextRoot('/home/user/project')).toBe('/home/user/project/.gcc/context');
  });

  it('uses CLAUDE_PROJECT_DIR when set', () => {
    process.env.CLAUDE_PROJECT_DIR = '/other/dir';
    expect(getGCCRoot('/home/user/project')).toBe('/other/dir/.gcc');
  });
});

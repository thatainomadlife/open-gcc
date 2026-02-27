import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logError, getGCCRoot, getContextRoot } from '../src/util.js';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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
    const lines = Array.from({ length: 110 }, (_, i) =>
      `[2026-01-01 00:00:00] Error ${i}\n`
    ).join('');
    writeFileSync(join(gccRoot, 'error.log'), lines);

    logError(gccRoot, 'trigger rotation');
    const content = readFileSync(join(gccRoot, 'error.log'), 'utf-8');
    const resultLines = content.split('\n').filter(Boolean);
    expect(resultLines.length).toBeLessThanOrEqual(51);
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

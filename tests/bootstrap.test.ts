import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureContextStructure } from '../src/bootstrap.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ensureContextStructure', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-boot-${Date.now()}`);
    mkdirSync(contextRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  it('creates all files from scratch', () => {
    const result = ensureContextStructure(contextRoot);
    expect(result).toBe(true);
    expect(existsSync(join(contextRoot, 'main.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'commits.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'log.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'branches', '_registry.md'))).toBe(true);
  });

  it('preserves existing main.md', () => {
    writeFileSync(join(contextRoot, 'main.md'), '# Custom Content');
    ensureContextStructure(contextRoot);
    expect(readFileSync(join(contextRoot, 'main.md'), 'utf-8')).toBe('# Custom Content');
  });

  it('creates missing files while preserving existing ones', () => {
    // Create main.md but not commits.md
    writeFileSync(join(contextRoot, 'main.md'), '# Custom');
    ensureContextStructure(contextRoot);
    expect(readFileSync(join(contextRoot, 'main.md'), 'utf-8')).toBe('# Custom');
    expect(existsSync(join(contextRoot, 'commits.md'))).toBe(true);
  });

  it('main.md template has expected sections', () => {
    ensureContextStructure(contextRoot);
    const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
    expect(content).toContain('## Current Focus');
    expect(content).toContain('## Recent Milestones');
    expect(content).toContain('## Open Branches');
  });
});

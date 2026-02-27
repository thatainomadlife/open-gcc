import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureContextStructure, ensureBranchDir } from '../src/bootstrap.js';
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

  it('creates v2 directory structure from scratch', () => {
    const result = ensureContextStructure(contextRoot);
    expect(result).toBe(true);
    expect(existsSync(join(contextRoot, 'main.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'branches', '_registry.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'branches', 'main', 'commits.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'branches', 'main', 'log.md'))).toBe(true);
  });

  it('preserves existing main.md', () => {
    writeFileSync(join(contextRoot, 'main.md'), '# Custom Content');
    ensureContextStructure(contextRoot);
    expect(readFileSync(join(contextRoot, 'main.md'), 'utf-8')).toBe('# Custom Content');
  });

  it('creates missing files while preserving existing ones', () => {
    writeFileSync(join(contextRoot, 'main.md'), '# Custom');
    ensureContextStructure(contextRoot);
    expect(readFileSync(join(contextRoot, 'main.md'), 'utf-8')).toBe('# Custom');
    expect(existsSync(join(contextRoot, 'branches', 'main', 'commits.md'))).toBe(true);
  });

  it('main.md template has expected sections', () => {
    ensureContextStructure(contextRoot);
    const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
    expect(content).toContain('## Current Focus');
    expect(content).toContain('## Recent Milestones');
    expect(content).toContain('## Open Branches');
  });

  it('commits.md lives inside branches/main/', () => {
    ensureContextStructure(contextRoot);
    // No root-level commits.md
    expect(existsSync(join(contextRoot, 'commits.md'))).toBe(false);
    // Per-branch commits.md
    const commits = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('# Milestone Journal');
  });
});

describe('ensureBranchDir', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-branch-${Date.now()}`);
    mkdirSync(join(contextRoot, 'branches'), { recursive: true });
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  it('creates branch directory with header template', () => {
    const result = ensureBranchDir(contextRoot, 'explore-caching', 'Test caching strategies', 'Redis will be faster');
    expect(result).toBe(true);

    const commits = readFileSync(join(contextRoot, 'branches', 'explore-caching', 'commits.md'), 'utf-8');
    expect(commits).toContain('# Branch: explore-caching');
    expect(commits).toContain('Test caching strategies');
    expect(commits).toContain('Redis will be faster');
    expect(commits).toContain('# Milestone Journal');

    expect(existsSync(join(contextRoot, 'branches', 'explore-caching', 'log.md'))).toBe(true);
  });

  it('preserves existing branch files', () => {
    mkdirSync(join(contextRoot, 'branches', 'existing'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', 'existing', 'commits.md'), '# Custom');

    ensureBranchDir(contextRoot, 'existing');
    expect(readFileSync(join(contextRoot, 'branches', 'existing', 'commits.md'), 'utf-8')).toBe('# Custom');
  });
});

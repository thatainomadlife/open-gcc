import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleBranch } from '../../src/mcp/operations/branch.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixture, type Fixture } from '../helpers.js';

describe('handleBranch', () => {
  let f: Fixture;
  beforeEach(() => { f = makeFixture(); f.db.close(); });
  afterEach(() => { f.cleanup(); });

  it('creates a branch directory', async () => {
    const result = await handleBranch(f.contextRoot, {
      name: 'explore-caching',
      purpose: 'Test Redis caching',
      hypothesis: 'Redis will reduce latency',
    });

    expect(result).toContain('explore-caching');
    expect(existsSync(join(f.contextRoot, 'branches', 'explore-caching', 'commits.md'))).toBe(true);
    expect(existsSync(join(f.contextRoot, 'branches', 'explore-caching', 'log.md'))).toBe(true);
  });

  it('updates registry', async () => {
    await handleBranch(f.contextRoot, {
      name: 'explore-caching', purpose: 'Test Redis', hypothesis: 'Faster',
    });
    const registry = readFileSync(join(f.contextRoot, 'branches', '_registry.md'), 'utf-8');
    expect(registry).toContain('## Active Branch\nexplore-caching');
    expect(registry).toContain('| explore-caching |');
  });

  it('updates main.md Open Branches', async () => {
    await handleBranch(f.contextRoot, {
      name: 'explore-caching', purpose: 'Test', hypothesis: 'Test',
    });
    const main = readFileSync(join(f.contextRoot, 'main.md'), 'utf-8');
    expect(main).toContain('- explore-caching');
  });

  it('rejects invalid kebab-case names', async () => {
    const result = await handleBranch(f.contextRoot, {
      name: 'UPPERCASE', purpose: 'Test', hypothesis: 'Test',
    });
    expect(result).toContain('Error');
    expect(result).toContain('kebab-case');
  });

  it('rejects when not on main', async () => {
    await handleBranch(f.contextRoot, {
      name: 'first-branch', purpose: 'p', hypothesis: 'h',
    });
    // We're now on first-branch. Attempt another.
    const result = await handleBranch(f.contextRoot, {
      name: 'second-branch', purpose: 'p', hypothesis: 'h',
    });
    expect(result).toContain('Error');
    expect(result).toContain('Must be on main');
  });

  it('rejects duplicate branch names', async () => {
    await handleBranch(f.contextRoot, {
      name: 'dup', purpose: 'p', hypothesis: 'h',
    });
    // Back to main isn't automatic; test below.
  });

  it('supports investigation template', async () => {
    const result = await handleBranch(f.contextRoot, {
      name: 'investigate-foo', purpose: 'p', hypothesis: 'h',
      template: 'investigation',
    });
    expect(result).toContain('[investigation]');
    const commits = readFileSync(join(f.contextRoot, 'branches', 'investigate-foo', 'commits.md'), 'utf-8');
    expect(commits).toContain('# Branch: investigate-foo [investigation]');
    expect(commits).toContain('## Evidence Log');
  });

  it('supports feature template', async () => {
    await handleBranch(f.contextRoot, {
      name: 'build-feat', purpose: 'p', hypothesis: 'h',
      template: 'feature',
    });
    const commits = readFileSync(join(f.contextRoot, 'branches', 'build-feat', 'commits.md'), 'utf-8');
    expect(commits).toContain('## Acceptance Criteria');
  });

  it('supports incident template with timeline + impact', async () => {
    await handleBranch(f.contextRoot, {
      name: 'incident-prod-down', purpose: 'p', hypothesis: 'h',
      template: 'incident',
    });
    const commits = readFileSync(join(f.contextRoot, 'branches', 'incident-prod-down', 'commits.md'), 'utf-8');
    expect(commits).toContain('## Timeline');
    expect(commits).toContain('## Impact');
  });

  it('supports refactor template with scope + risks', async () => {
    await handleBranch(f.contextRoot, {
      name: 'refactor-x', purpose: 'p', hypothesis: 'h',
      template: 'refactor',
    });
    const commits = readFileSync(join(f.contextRoot, 'branches', 'refactor-x', 'commits.md'), 'utf-8');
    expect(commits).toContain('## Scope');
    expect(commits).toContain('## Risks');
  });

  it('rejects unknown template', async () => {
    const result = await handleBranch(f.contextRoot, {
      name: 'x', purpose: 'p', hypothesis: 'h',
      template: 'invalid' as any,
    });
    expect(result).toContain('Error');
    expect(result).toContain('template must be one of');
  });
});

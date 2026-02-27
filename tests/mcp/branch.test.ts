import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleBranch } from '../../src/mcp/operations/branch.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('handleBranch', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-mcp-branch-${Date.now()}`);
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n| Branch | Status | Created |\n|--------|--------|---------|');
    writeFileSync(join(contextRoot, 'main.md'),
      '# Project\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- (none)\n');
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  it('creates a branch directory', async () => {
    const result = await handleBranch(contextRoot, {
      name: 'explore-caching',
      purpose: 'Test Redis caching',
      hypothesis: 'Redis will reduce latency',
    });

    expect(result).toContain('explore-caching');
    expect(existsSync(join(contextRoot, 'branches', 'explore-caching', 'commits.md'))).toBe(true);
    expect(existsSync(join(contextRoot, 'branches', 'explore-caching', 'log.md'))).toBe(true);
  });

  it('updates registry', async () => {
    await handleBranch(contextRoot, {
      name: 'explore-caching',
      purpose: 'Test Redis',
      hypothesis: 'Faster',
    });

    const registry = readFileSync(join(contextRoot, 'branches', '_registry.md'), 'utf-8');
    expect(registry).toContain('## Active Branch\nexplore-caching');
    expect(registry).toContain('| explore-caching | active |');
  });

  it('updates main.md Open Branches', async () => {
    await handleBranch(contextRoot, {
      name: 'explore-caching',
      purpose: 'Test',
      hypothesis: 'Test',
    });

    const main = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
    expect(main).toContain('- explore-caching');
  });

  it('rejects invalid kebab-case names', async () => {
    const result = await handleBranch(contextRoot, {
      name: 'UPPERCASE',
      purpose: 'Test',
      hypothesis: 'Test',
    });
    expect(result).toContain('Error');
    expect(result).toContain('kebab-case');
  });

  it('rejects when not on main', async () => {
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nexisting-branch\n\n## Branch History\n');

    const result = await handleBranch(contextRoot, {
      name: 'new-branch',
      purpose: 'Test',
      hypothesis: 'Test',
    });
    expect(result).toContain('Error');
    expect(result).toContain('Must be on main');
  });

  it('rejects duplicate branch names', async () => {
    mkdirSync(join(contextRoot, 'branches', 'existing'), { recursive: true });

    const result = await handleBranch(contextRoot, {
      name: 'existing',
      purpose: 'Test',
      hypothesis: 'Test',
    });
    expect(result).toContain('Error');
    expect(result).toContain('already exists');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleMerge } from '../../src/mcp/operations/merge.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('handleMerge', () => {
  let gccRoot: string;
  let contextRoot: string;

  beforeEach(() => {
    gccRoot = join(tmpdir(), `gcc-mcp-merge-${Date.now()}`);
    contextRoot = join(gccRoot, 'context');
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });
    mkdirSync(join(contextRoot, 'branches', 'explore-x'), { recursive: true });

    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nexplore-x\n\n## Branch History\n| Branch | Status | Created |\n|--------|--------|---------|\n| explore-x | active | 2026-02-26 |');
    writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), '# Milestone Journal\n\n');
    writeFileSync(join(contextRoot, 'branches', 'main', 'log.md'), '');
    writeFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'),
      '# Branch: explore-x\n\n## Purpose\nTest caching\n\n## Hypothesis\nRedis faster\n\n## Conclusion\n(Fill in at merge time — success/failure/partial)\n\n---\n\n# Milestone Journal\n\n');
    writeFileSync(join(contextRoot, 'branches', 'explore-x', 'log.md'), '');
    writeFileSync(join(contextRoot, 'main.md'),
      '# Project\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- explore-x\n');
  });

  afterEach(() => {
    rmSync(gccRoot, { recursive: true, force: true });
  });

  it('merges branch successfully', async () => {
    const result = await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'Redis caching works great',
    });

    expect(result).toContain('Merged');
    expect(result).toContain('explore-x');
    expect(result).toContain('success');
    expect(result).toContain('C001');
  });

  it('creates merge commit on main', async () => {
    await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'It worked',
    });

    const mainCommits = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(mainCommits).toContain('[C001]');
    expect(mainCommits).toContain('Merge: explore-x');
  });

  it('fills conclusion in branch header', async () => {
    await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'failure',
      conclusion: 'Redis was too complex',
    });

    const branchCommits = readFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'), 'utf-8');
    expect(branchCommits).toContain('**Outcome**: failure');
    expect(branchCommits).toContain('Redis was too complex');
  });

  it('switches back to main', async () => {
    await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'partial',
      conclusion: 'Some findings useful',
    });

    const registry = readFileSync(join(contextRoot, 'branches', '_registry.md'), 'utf-8');
    expect(registry).toContain('## Active Branch\nmain');
    expect(registry).toContain('| explore-x | merged |');
  });

  it('removes branch from Open Branches', async () => {
    await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'Done',
    });

    const main = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
    expect(main).not.toContain('- explore-x');
    expect(main).toContain('- (none)');
  });

  it('rejects merging main into itself', async () => {
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n');

    const result = await handleMerge(contextRoot, {
      branch_name: 'main',
      outcome: 'success',
      conclusion: 'Done',
    });

    expect(result).toContain('Error');
    expect(result).toContain('Cannot merge main');
  });

  it('handles branch with no commits', async () => {
    // Branch exists but has no commit entries (only header)
    const result = await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'failure',
      conclusion: 'Abandoned early — no useful findings',
    });

    expect(result).toContain('Merged');
    expect(result).toContain('explore-x');
    expect(result).toContain('failure');
  });

  it('rejects when not on the named branch', async () => {
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n');

    const result = await handleMerge(contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'Done',
    });

    expect(result).toContain('Error');
    expect(result).toContain('Must be on branch');
  });
});

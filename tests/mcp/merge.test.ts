import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleBranch } from '../../src/mcp/operations/branch.js';
import { handleMerge } from '../../src/mcp/operations/merge.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixture, type Fixture } from '../helpers.js';

describe('handleMerge', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = makeFixture();
    f.db.close();
    await handleBranch(f.contextRoot, {
      name: 'explore-x',
      purpose: 'Test caching',
      hypothesis: 'Redis faster',
    });
  });
  afterEach(() => { f.cleanup(); });

  it('merges branch successfully', async () => {
    const result = await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'Redis caching works great',
    });
    expect(result).toContain('Merged');
    expect(result).toContain('explore-x');
    expect(result).toContain('success');
  });

  it('creates merge commit on main', async () => {
    await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'It worked',
    });
    const mainCommits = readFileSync(join(f.contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(mainCommits).toContain('Merge: explore-x');
  });

  it('fills conclusion in branch header', async () => {
    await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'failure',
      conclusion: 'Redis was too complex',
    });
    const branchCommits = readFileSync(join(f.contextRoot, 'branches', 'explore-x', 'commits.md'), 'utf-8');
    expect(branchCommits).toContain('**Outcome**: failure');
    expect(branchCommits).toContain('Redis was too complex');
  });

  it('switches back to main', async () => {
    await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'partial',
      conclusion: 'Some findings useful',
    });
    const registry = readFileSync(join(f.contextRoot, 'branches', '_registry.md'), 'utf-8');
    expect(registry).toContain('## Active Branch\nmain');
    expect(registry).toContain('| explore-x | merged |');
  });

  it('rejects merging main into itself', async () => {
    const result = await handleMerge(f.contextRoot, {
      branch_name: 'main',
      outcome: 'success',
      conclusion: 'Done',
    });
    expect(result).toContain('Error');
    expect(result).toContain('Cannot merge main');
  });

  it('records confidence and evidence_files in branch header', async () => {
    await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'Redis caching cut p99 from 800ms to 120ms',
      confidence: 'high',
      evidence_files: ['bench/before.txt', 'bench/after.txt', 'grafana/latency.png'],
    });
    const branchCommits = readFileSync(join(f.contextRoot, 'branches', 'explore-x', 'commits.md'), 'utf-8');
    expect(branchCommits).toContain('**Confidence**: high');
    expect(branchCommits).toContain('**Evidence**:');
    expect(branchCommits).toContain('- bench/before.txt');
    expect(branchCommits).toContain('- grafana/latency.png');
  });

  it('rejects invalid confidence value', async () => {
    const result = await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'x',
      confidence: 'kinda' as any,
    });
    expect(result).toContain('Error');
    expect(result).toContain('confidence must be one of');
  });

  it('merge summary includes confidence when provided', async () => {
    const result = await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'done',
      confidence: 'medium',
    });
    expect(result).toContain('medium');
  });

  it('rejects when not on the named branch', async () => {
    // Merge explore-x first to return to main
    await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'Done',
    });
    // Create another branch but don't switch to it
    await handleBranch(f.contextRoot, {
      name: 'other', purpose: 'p', hypothesis: 'h',
    });
    // We're on 'other' now, try merging a nonexistent branch name
    const result = await handleMerge(f.contextRoot, {
      branch_name: 'explore-x',
      outcome: 'success',
      conclusion: 'x',
    });
    expect(result).toContain('Error');
    expect(result).toContain('Must be on branch');
  });
});

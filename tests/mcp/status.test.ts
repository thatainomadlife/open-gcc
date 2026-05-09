import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleStatus } from '../../src/mcp/operations/status.js';
import { handleCommit } from '../../src/mcp/operations/commit.js';
import { handleBranch } from '../../src/mcp/operations/branch.js';
import { makeFixture, type Fixture } from '../helpers.js';

describe('handleStatus', () => {
  let f: Fixture;
  beforeEach(() => { f = makeFixture(); f.db.close(); });
  afterEach(() => { f.cleanup(); });

  it('returns status with no commits', async () => {
    const result = await handleStatus(f.contextRoot, {});
    expect(result).toContain('Active branch');
    expect(result).toContain('main');
    expect(result).toContain('Last commit');
    expect(result).toContain('(none)');
  });

  it('returns status with commits', async () => {
    await handleCommit(f.contextRoot, {
      title: 'Added auth module',
      what: 'JWT auth',
      why: 'Security',
      files_changed: ['src/auth.ts'],
      next_step: 'Tests',
    });
    const result = await handleStatus(f.contextRoot, {});
    expect(result).toContain('C001');
    expect(result).toContain('Added auth module');
  });

  it('shows open branches', async () => {
    await handleBranch(f.contextRoot, {
      name: 'explore-caching', purpose: 'p', hypothesis: 'h',
    });
    const result = await handleStatus(f.contextRoot, {});
    expect(result).toContain('explore-caching');
  });

  it('shows no open branches when none', async () => {
    const result = await handleStatus(f.contextRoot, {});
    expect(result).toContain('Open branches**: (none)');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleContext } from '../../src/mcp/operations/context.js';
import { handleCommit } from '../../src/mcp/operations/commit.js';
import { handleBranch } from '../../src/mcp/operations/branch.js';
import { makeFixture, type Fixture } from '../helpers.js';

describe('handleContext', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = makeFixture();
    f.db.close();
    // Seed 3 commits on main
    await handleCommit(f.contextRoot, {
      title: 'Initial setup', what: 'Project scaffolding', why: 'Starting point',
      files_changed: ['package.json'], next_step: 'Add database',
    });
    await handleCommit(f.contextRoot, {
      title: 'Database setup', what: 'Created schema', why: 'Persistence',
      files_changed: ['src/db.ts'], next_step: 'Add auth',
    });
    await handleCommit(f.contextRoot, {
      title: 'Added auth', what: 'Implemented authentication', why: 'Security',
      files_changed: ['src/auth.ts'], next_step: 'Add tests',
    });
  });
  afterEach(() => { f.cleanup(); });

  it('level 1: returns main context without commits', async () => {
    const result = await handleContext(f.contextRoot, { level: 1 });
    expect(result).toContain('## GCC Context');
    // Level 1 should not include expanded "Recent Commits" section,
    // but main.md's "Recent Commit Details" does include commit text.
    expect(result).not.toContain('## Recent Commits (');
  });

  it('level 2: includes recent commits section', async () => {
    const result = await handleContext(f.contextRoot, { level: 2 });
    expect(result).toContain('[C003]');
    expect(result).toContain('Added auth');
  });

  it('level 3: includes branch header for non-main branches', async () => {
    await handleBranch(f.contextRoot, {
      name: 'explore-x', purpose: 'Test caching', hypothesis: 'Faster',
    });
    const result = await handleContext(f.contextRoot, { level: 3, branch: 'explore-x' });
    expect(result).toContain('Test caching');
  });

  it('level 4: extended history', async () => {
    const result = await handleContext(f.contextRoot, { level: 4 });
    expect(result).toContain('Extended History');
    expect(result).toContain('[C001]');
  });

  it('level 5: finds specific commit by ID', async () => {
    const result = await handleContext(f.contextRoot, { level: 5, commit_id: 'C002' });
    expect(result).toContain('Database setup');
  });

  it('level 5: searches by term', async () => {
    const result = await handleContext(f.contextRoot, { level: 5, metadata_segment: 'auth' });
    expect(result).toContain('Added auth');
  });

  it('level 5: reports not found for missing commit', async () => {
    const result = await handleContext(f.contextRoot, { level: 5, commit_id: 'C999' });
    expect(result).toContain('not found');
  });

  it('rejects invalid level', async () => {
    const result = await handleContext(f.contextRoot, { level: 0 });
    expect(result).toContain('Error');
  });
});

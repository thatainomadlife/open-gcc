import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleCommit } from '../../src/mcp/operations/commit.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixture, type Fixture } from '../helpers.js';

describe('handleCommit', () => {
  let f: Fixture;
  beforeEach(() => { f = makeFixture(); f.db.close(); });
  afterEach(() => { f.cleanup(); });

  it('creates a commit entry', async () => {
    const result = await handleCommit(f.contextRoot, {
      title: 'Added auth module',
      what: 'Implemented JWT authentication',
      why: 'Users need to log in',
      files_changed: ['src/auth.ts', 'src/middleware.ts'],
      next_step: 'Add tests for auth',
    });

    expect(result).toContain('C001');
    expect(result).toContain('branch:main');

    const commits = readFileSync(join(f.contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('[C001]');
    expect(commits).toContain('Added auth module');
    expect(commits).toContain('JWT authentication');
  });

  it('updates main.md milestones', async () => {
    await handleCommit(f.contextRoot, {
      title: 'Added auth',
      what: 'Auth done',
      why: 'Security',
      files_changed: ['auth.ts'],
      next_step: 'Test',
    });

    const main = readFileSync(join(f.contextRoot, 'main.md'), 'utf-8');
    expect(main).toContain('Added auth');
    expect(main).not.toContain('(none yet)');
  });

  it('returns error on missing fields', async () => {
    const result = await handleCommit(f.contextRoot, {
      title: 'Test',
      what: '',
      why: 'Reason',
      files_changed: ['a.ts'],
      next_step: 'Next',
    });
    expect(result).toContain('Error');
  });

  it('returns error on empty files_changed array', async () => {
    const result = await handleCommit(f.contextRoot, {
      title: 'Test',
      what: 'Did something',
      why: 'Reason',
      files_changed: [],
      next_step: 'Next',
    });
    expect(result).toContain('Error');
  });

  it('rejects whitespace-only file paths', async () => {
    const result = await handleCommit(f.contextRoot, {
      title: 'Test',
      what: 'Did something',
      why: 'Reason',
      files_changed: ['', '   ', '\t'],
      next_step: 'Next',
    });
    expect(result).toContain('Error');
  });

  it('increments commit IDs globally', async () => {
    await handleCommit(f.contextRoot, {
      title: 'First', what: 'x', why: 'y',
      files_changed: ['a.ts'], next_step: 'n',
    });
    const r2 = await handleCommit(f.contextRoot, {
      title: 'Second', what: 'x', why: 'y',
      files_changed: ['b.ts'], next_step: 'n',
    });
    expect(r2).toContain('C002');
  });

  it('accepts optional tags', async () => {
    const result = await handleCommit(f.contextRoot, {
      title: 'x', what: 'w', why: 'y',
      files_changed: ['a'], next_step: 'n',
      tags: ['malware', 'honeypot'],
    });
    expect(result).toContain('C001');
    const commits = readFileSync(join(f.contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('**Tags**:');
    expect(commits).toContain('malware');
  });
});

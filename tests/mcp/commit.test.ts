import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleCommit } from '../../src/mcp/operations/commit.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('handleCommit', () => {
  let gccRoot: string;
  let contextRoot: string;

  beforeEach(() => {
    gccRoot = join(tmpdir(), `gcc-mcp-commit-${Date.now()}`);
    contextRoot = join(gccRoot, 'context');
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n');
    writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), '# Milestone Journal\n\n');
    writeFileSync(join(contextRoot, 'branches', 'main', 'log.md'), '');
    writeFileSync(join(contextRoot, 'main.md'),
      '# Project\n\n## Current Focus\nTest\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- (none)\n');
  });

  afterEach(() => {
    rmSync(gccRoot, { recursive: true, force: true });
  });

  it('creates a commit entry', async () => {
    const result = await handleCommit(contextRoot, {
      title: 'Added auth module',
      what: 'Implemented JWT authentication',
      why: 'Users need to log in',
      files_changed: ['src/auth.ts', 'src/middleware.ts'],
      next_step: 'Add tests for auth',
    });

    expect(result).toContain('C001');
    expect(result).toContain('branch:main');

    const commits = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('[C001]');
    expect(commits).toContain('Added auth module');
    expect(commits).toContain('JWT authentication');
  });

  it('updates main.md milestones', async () => {
    await handleCommit(contextRoot, {
      title: 'Added auth',
      what: 'Auth done',
      why: 'Security',
      files_changed: ['auth.ts'],
      next_step: 'Test',
    });

    const main = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
    expect(main).toContain('Added auth');
    expect(main).not.toContain('(none yet)');
  });

  it('returns error on missing fields', async () => {
    const result = await handleCommit(contextRoot, {
      title: 'Test',
      what: '',
      why: 'Reason',
      files_changed: ['a.ts'],
      next_step: 'Next',
    });

    expect(result).toContain('Error');
  });

  it('returns error on empty files_changed array', async () => {
    const result = await handleCommit(contextRoot, {
      title: 'Test',
      what: 'Did something',
      why: 'Reason',
      files_changed: [],
      next_step: 'Next',
    });

    expect(result).toContain('Error');
  });

  it('increments commit IDs', async () => {
    await handleCommit(contextRoot, {
      title: 'First',
      what: 'First commit',
      why: 'Start',
      files_changed: ['a.ts'],
      next_step: 'Continue',
    });
    await handleCommit(contextRoot, {
      title: 'Second',
      what: 'Second commit',
      why: 'Progress',
      files_changed: ['b.ts'],
      next_step: 'More',
    });

    const commits = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('[C001]');
    expect(commits).toContain('[C002]');
    // C002 should come before C001 (prepend order)
    expect(commits.indexOf('[C002]')).toBeLessThan(commits.indexOf('[C001]'));
  });
});

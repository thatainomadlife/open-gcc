import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixture, renderFixture, type Fixture } from './helpers.js';

describe('render', () => {
  let f: Fixture;
  beforeEach(() => { f = makeFixture(); });
  afterEach(() => { f.cleanup(); });

  it('writes main.md with the standard sections', async () => {
    await renderFixture(f);
    const main = readFileSync(join(f.contextRoot, 'main.md'), 'utf-8');
    expect(main).toContain('# Project Context');
    expect(main).toContain('## Current Focus');
    expect(main).toContain('## Recent Milestones');
    expect(main).toContain('## Open Branches');
  });

  it('writes _registry.md with active branch and history', async () => {
    await renderFixture(f);
    const reg = readFileSync(join(f.contextRoot, 'branches', '_registry.md'), 'utf-8');
    expect(reg).toContain('## Active Branch\nmain');
    expect(reg).toContain('| main |');
  });

  it('renders commits in main branch', async () => {
    f.db.insertCommit({
      title: 'Added auth',
      what: 'JWT auth',
      why: 'Security',
      next_step: 'Tests',
      files: ['src/auth.ts'],
    });
    await renderFixture(f);
    const commits = readFileSync(join(f.contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('[C001]');
    expect(commits).toContain('branch:main');
    expect(commits).toContain('Added auth');
    expect(commits).toContain('**What**: JWT auth');
    expect(commits).toContain('**Files**: src/auth.ts');
  });

  it('renders tags when present', async () => {
    f.db.insertCommit({
      title: 'x', what: 'w', why: 'y', next_step: 'n',
      files: ['a'],
      tags: ['malware', 'honeypot'],
    });
    await renderFixture(f);
    const commits = readFileSync(join(f.contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
    expect(commits).toContain('**Tags**:');
    expect(commits).toContain('malware');
  });

  it('renders branch header for exploration branches', async () => {
    f.db.createBranch({ name: 'explore-x', purpose: 'Test caching', hypothesis: 'Faster' });
    await renderFixture(f);
    const commits = readFileSync(join(f.contextRoot, 'branches', 'explore-x', 'commits.md'), 'utf-8');
    expect(commits).toContain('# Branch: explore-x');
    expect(commits).toContain('## Purpose\nTest caching');
    expect(commits).toContain('## Hypothesis\nFaster');
  });

  it('renders merged branch conclusion', async () => {
    f.db.createBranch({ name: 'a', purpose: 'p', hypothesis: 'h' });
    f.db.updateBranchConclusion('a', { outcome: 'success', conclusion: 'worked great' });
    await renderFixture(f);
    const commits = readFileSync(join(f.contextRoot, 'branches', 'a', 'commits.md'), 'utf-8');
    expect(commits).toContain('**Outcome**: success');
    expect(commits).toContain('worked great');
  });

  it('renders log.md as a pipe-table', async () => {
    f.db.appendLog({ event: 'tool-use', toolName: 'edit', summary: 'src/foo.ts' });
    f.db.appendLog({ event: 'tool-use', toolName: 'bash', summary: 'npm test' });
    await renderFixture(f);
    const log = readFileSync(join(f.contextRoot, 'branches', 'main', 'log.md'), 'utf-8');
    expect(log).toContain('| timestamp | event');
    expect(log).toContain('tool-use');
    expect(log).toContain('src/foo.ts');
  });

  it('creates branch directories as needed', async () => {
    f.db.createBranch({ name: 'explore-y', purpose: 'p', hypothesis: 'h' });
    await renderFixture(f);
    expect(existsSync(join(f.contextRoot, 'branches', 'explore-y', 'commits.md'))).toBe(true);
    expect(existsSync(join(f.contextRoot, 'branches', 'explore-y', 'log.md'))).toBe(true);
  });
});

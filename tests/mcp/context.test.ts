import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleContext } from '../../src/mcp/operations/context.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('handleContext', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-mcp-context-${Date.now()}`);
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });

    writeFileSync(join(contextRoot, 'main.md'),
      '# Project Context\n\n## Current Focus\nBuilding auth\n\n## Recent Milestones\n- 2026-02-26: Added login (main)\n\n## Open Branches\n- (none)\n');
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n');
    writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'),
      `# Milestone Journal

## [C003] 2026-02-26 14:00 | branch:main | Added auth
**What**: Implemented authentication
**Why**: Security
**Files**: src/auth.ts
**Next**: Add tests

---

## [C002] 2026-02-26 12:00 | branch:main | Database setup
**What**: Created schema
**Why**: Persistence
**Files**: src/db.ts
**Next**: Add auth

---

## [C001] 2026-02-25 10:00 | branch:main | Initial setup
**What**: Project scaffolding
**Why**: Starting point
**Files**: package.json
**Next**: Add database

---

`);
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  it('level 1: returns main.md only', async () => {
    const result = await handleContext(contextRoot, { level: 1 });
    expect(result).toContain('Building auth');
    expect(result).not.toContain('[C003]');
  });

  it('level 2: includes recent commits', async () => {
    const result = await handleContext(contextRoot, { level: 2 });
    expect(result).toContain('Building auth');
    expect(result).toContain('[C003]');
    expect(result).toContain('Added auth');
  });

  it('level 3: includes branch header for non-main branches', async () => {
    // Create a branch with header
    mkdirSync(join(contextRoot, 'branches', 'explore-x'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'),
      '# Branch: explore-x\n\n## Purpose\nTest caching\n\n## Hypothesis\nFaster\n\n---\n\n# Milestone Journal\n\n');
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nexplore-x\n\n## Branch History\n');

    const result = await handleContext(contextRoot, { level: 3, branch: 'explore-x' });
    expect(result).toContain('Test caching');
  });

  it('level 4: includes more commits', async () => {
    const result = await handleContext(contextRoot, { level: 4 });
    expect(result).toContain('Extended History');
    expect(result).toContain('[C001]');
  });

  it('level 5: finds specific commit by ID', async () => {
    const result = await handleContext(contextRoot, { level: 5, commit_id: 'C002' });
    expect(result).toContain('Database setup');
    expect(result).toContain('Created schema');
  });

  it('level 5: searches by metadata', async () => {
    const result = await handleContext(contextRoot, { level: 5, metadata_segment: 'auth' });
    expect(result).toContain('Added auth');
  });

  it('level 5: reports not found for missing commit', async () => {
    const result = await handleContext(contextRoot, { level: 5, commit_id: 'C999' });
    expect(result).toContain('not found');
  });

  it('uses explicit branch parameter', async () => {
    mkdirSync(join(contextRoot, 'branches', 'feature'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', 'feature', 'commits.md'),
      '# Milestone Journal\n\n## [C001] 2026-02-26 | branch:feature | Feature work\n**What**: Did feature\n\n---\n\n');

    const result = await handleContext(contextRoot, { level: 2, branch: 'feature' });
    expect(result).toContain('Feature work');
  });

  it('level 3 on main returns same as level 2', async () => {
    const result2 = await handleContext(contextRoot, { level: 2 });
    const result3 = await handleContext(contextRoot, { level: 3 });
    // On main branch, level 3 adds no branch header — output should be identical
    expect(result3).toBe(result2);
  });

  it('level 4 does not duplicate level 2 commits', async () => {
    const result = await handleContext(contextRoot, { level: 4 });
    // Should have Extended History section but NOT Recent Commits section
    expect(result).toContain('Extended History');
    expect(result).not.toContain('Recent Commits');
    // All 3 commits should still be present (within the 10-commit fetch)
    expect(result).toContain('[C003]');
    expect(result).toContain('[C001]');
  });

  it('rejects invalid level', async () => {
    const result = await handleContext(contextRoot, { level: 0 });
    expect(result).toContain('Error');
  });
});

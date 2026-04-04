import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleStatus } from '../../src/mcp/operations/status.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('handleStatus', () => {
  let gccRoot: string;
  let contextRoot: string;

  beforeEach(() => {
    gccRoot = join(tmpdir(), `gcc-mcp-status-${Date.now()}`);
    contextRoot = join(gccRoot, 'context');
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n| Branch | Status | Created |\n|--------|--------|---------|\n| main | active | (root) |\n');
    writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), '# Milestone Journal\n\n');
    writeFileSync(join(contextRoot, 'branches', 'main', 'log.md'), '');
    writeFileSync(join(contextRoot, 'main.md'),
      '# Project\n\n## Current Focus\nTest\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- (none)\n');
  });

  afterEach(() => {
    rmSync(gccRoot, { recursive: true, force: true });
  });

  it('returns status with no commits', async () => {
    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('Active branch');
    expect(result).toContain('main');
    expect(result).toContain('Last commit');
    expect(result).toContain('(none)');
  });

  it('returns status with commits', async () => {
    writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'),
      `# Milestone Journal\n\n## [C003] 2026-04-04 14:30 | branch:main | Added auth module\n**What**: JWT auth\n**Why**: Security\n**Files**: src/auth.ts\n**Next**: Tests\n\n---\n\n## [C002] 2026-04-03 10:00 | branch:main | Setup CI\n**What**: CI pipeline\n**Why**: Automation\n**Files**: .forgejo/\n**Next**: Deploy\n\n---\n\n`);

    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('C003');
    expect(result).toContain('Added auth module');
    expect(result).toContain('2026-04-04 14:30');
  });

  it('counts tool operations since last commit', async () => {
    writeFileSync(join(contextRoot, 'branches', 'main', 'log.md'),
      `[2026-04-04] COMMIT C001: Initial setup\n| 2026-04-04 15:00 | edit | src/foo.ts | OK |\n| 2026-04-04 15:05 | edit | src/bar.ts | OK |\n| 2026-04-04 15:10 | bash | npm test | OK |\n`);

    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('Tool operations since last commit**: 3');
  });

  it('counts zero when commit is last entry', async () => {
    writeFileSync(join(contextRoot, 'branches', 'main', 'log.md'),
      `| 2026-04-04 15:00 | edit | src/foo.ts | OK |\n[2026-04-04] COMMIT C002: Latest\n`);

    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('Tool operations since last commit**: 0');
  });

  it('shows open branches', async () => {
    writeFileSync(join(contextRoot, 'main.md'),
      '# Project\n\n## Current Focus\nTest\n\n## Recent Milestones\n- milestone\n\n## Open Branches\n- explore-caching\n- fix-auth\n');

    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('explore-caching, fix-auth');
  });

  it('shows no open branches when none', async () => {
    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('Open branches**: (none)');
  });

  it('works on non-main branch', async () => {
    mkdirSync(join(contextRoot, 'branches', 'explore-x'), { recursive: true });
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nexplore-x\n\n## Branch History\n');
    writeFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'),
      `# Branch: explore-x\n\n## Purpose\nTest\n\n## Hypothesis\nTest\n\n## Conclusion\n(Fill in at merge time)\n\n---\n\n# Milestone Journal\n\n## [C001] 2026-04-04 10:00 | branch:explore-x | Start exploration\n**What**: Started\n**Why**: Testing\n**Files**: test.ts\n**Next**: Continue\n\n---\n\n`);
    writeFileSync(join(contextRoot, 'branches', 'explore-x', 'log.md'), '');

    const result = await handleStatus(contextRoot, {});
    expect(result).toContain('explore-x');
    expect(result).toContain('C001');
    expect(result).toContain('Start exploration');
  });
});

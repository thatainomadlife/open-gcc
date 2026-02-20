import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getNextCommitId,
  getActiveBranch,
  prependCommit,
  updateMainMilestones,
  readMainContext,
  readRecentCommits,
} from '../src/context.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('context', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-ctx-${Date.now()}`);
    mkdirSync(join(contextRoot, 'branches'), { recursive: true });
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  describe('getNextCommitId', () => {
    it('returns C001 when no commits exist', () => {
      expect(getNextCommitId(contextRoot)).toBe('C001');
    });

    it('returns C001 when commits.md is empty', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n');
      expect(getNextCommitId(contextRoot)).toBe('C001');
    });

    it('increments from latest commit', () => {
      writeFileSync(join(contextRoot, 'commits.md'),
        '# Milestone Journal\n\n## [C005] 2026-01-01 12:00 | branch:main | Test\n');
      expect(getNextCommitId(contextRoot)).toBe('C006');
    });

    it('pads to 3 digits', () => {
      writeFileSync(join(contextRoot, 'commits.md'),
        '# Milestone Journal\n\n## [C099] 2026-01-01 12:00 | branch:main | Test\n');
      expect(getNextCommitId(contextRoot)).toBe('C100');
    });
  });

  describe('getActiveBranch', () => {
    it('returns main when no registry exists', () => {
      expect(getActiveBranch(contextRoot)).toBe('main');
    });

    it('reads active branch from registry', () => {
      writeFileSync(join(contextRoot, 'branches', '_registry.md'),
        '## Active Branch\nfeature-x\n\n## Branch History\n');
      expect(getActiveBranch(contextRoot)).toBe('feature-x');
    });
  });

  describe('prependCommit', () => {
    it('prepends after header', async () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n');
      await prependCommit(contextRoot, '## [C001] new entry\n\n');
      const content = readFileSync(join(contextRoot, 'commits.md'), 'utf-8');
      expect(content).toBe('# Milestone Journal\n\n## [C001] new entry\n\n');
    });

    it('prepends before existing commits', async () => {
      writeFileSync(join(contextRoot, 'commits.md'),
        '# Milestone Journal\n\n## [C001] old entry\n');
      await prependCommit(contextRoot, '## [C002] new entry\n\n');
      const content = readFileSync(join(contextRoot, 'commits.md'), 'utf-8');
      expect(content.indexOf('[C002]')).toBeLessThan(content.indexOf('[C001]'));
    });

    it('creates file if missing', async () => {
      await prependCommit(contextRoot, '## [C001] first\n');
      const content = readFileSync(join(contextRoot, 'commits.md'), 'utf-8');
      expect(content).toContain('[C001]');
    });
  });

  describe('updateMainMilestones', () => {
    it('adds entry to milestones section', async () => {
      writeFileSync(join(contextRoot, 'main.md'),
        '# Project\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- (none)\n');
      await updateMainMilestones(contextRoot, '2026-01-15', 'main', 'Added feature');
      const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
      expect(content).toContain('2026-01-15: Added feature (main)');
      expect(content).not.toContain('(none yet)');
    });

    it('keeps only milestonesKept entries', async () => {
      const entries = Array.from({ length: 6 }, (_, i) =>
        `- 2026-01-${String(i + 1).padStart(2, '0')}: Entry ${i + 1} (main)`
      ).join('\n');
      writeFileSync(join(contextRoot, 'main.md'),
        `# Project\n\n## Recent Milestones\n${entries}\n\n## Open Branches\n`);
      await updateMainMilestones(contextRoot, '2026-01-20', 'main', 'New entry', 3);
      const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
      const milestoneLines = content.split('\n').filter(l => l.startsWith('- 2026'));
      expect(milestoneLines).toHaveLength(3);
      expect(milestoneLines[0]).toContain('New entry');
    });
  });

  describe('readMainContext', () => {
    it('returns null when file missing', () => {
      expect(readMainContext(contextRoot)).toBeNull();
    });

    it('returns file contents', () => {
      writeFileSync(join(contextRoot, 'main.md'), '# Test Content');
      expect(readMainContext(contextRoot)).toBe('# Test Content');
    });
  });

  describe('readRecentCommits', () => {
    it('returns empty string when no commits', () => {
      expect(readRecentCommits(contextRoot)).toBe('');
    });

    it('returns last N commits', () => {
      const commits = `# Milestone Journal

## [C003] 2026-01-03 12:00 | branch:main | Third
**What**: Third thing

---

## [C002] 2026-01-02 12:00 | branch:main | Second
**What**: Second thing

---

## [C001] 2026-01-01 12:00 | branch:main | First
**What**: First thing

---

`;
      writeFileSync(join(contextRoot, 'commits.md'), commits);
      const result = readRecentCommits(contextRoot, 2);
      expect(result).toContain('[C003]');
      expect(result).toContain('[C002]');
      expect(result).not.toContain('[C001]');
    });
  });
});

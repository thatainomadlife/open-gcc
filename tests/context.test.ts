import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getNextCommitId,
  getActiveBranch,
  prependCommit,
  updateMainMilestones,
  readMainContext,
  readRecentCommits,
  updateRegistryActiveBranch,
  addBranchToRegistry,
  updateRegistryBranchStatus,
  addBranchToMainMd,
  removeBranchFromMainMd,
  getBranchHeader,
  updateBranchConclusion,
  appendLog,
} from '../src/context.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('context', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-ctx-${Date.now()}`);
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  describe('getNextCommitId', () => {
    it('returns C001 when no commits exist', () => {
      expect(getNextCommitId(contextRoot, 'main')).toBe('C001');
    });

    it('returns C001 when commits.md is empty', () => {
      writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), '# Milestone Journal\n\n');
      expect(getNextCommitId(contextRoot, 'main')).toBe('C001');
    });

    it('increments from latest commit', () => {
      writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'),
        '# Milestone Journal\n\n## [C005] 2026-01-01 12:00 | branch:main | Test\n');
      expect(getNextCommitId(contextRoot, 'main')).toBe('C006');
    });

    it('pads to 3 digits', () => {
      writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'),
        '# Milestone Journal\n\n## [C099] 2026-01-01 12:00 | branch:main | Test\n');
      expect(getNextCommitId(contextRoot, 'main')).toBe('C100');
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
      writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), '# Milestone Journal\n\n');
      await prependCommit(contextRoot, 'main', '## [C001] new entry\n\n');
      const content = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
      expect(content).toBe('# Milestone Journal\n\n## [C001] new entry\n\n');
    });

    it('prepends before existing commits', async () => {
      writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'),
        '# Milestone Journal\n\n## [C001] old entry\n');
      await prependCommit(contextRoot, 'main', '## [C002] new entry\n\n');
      const content = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
      expect(content.indexOf('[C002]')).toBeLessThan(content.indexOf('[C001]'));
    });

    it('creates branch dir if missing', async () => {
      await prependCommit(contextRoot, 'new-branch', '## [C001] first\n');
      const content = readFileSync(join(contextRoot, 'branches', 'new-branch', 'commits.md'), 'utf-8');
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
      expect(readRecentCommits(contextRoot, 'main')).toBe('');
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
      writeFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), commits);
      const result = readRecentCommits(contextRoot, 'main', 2);
      expect(result).toContain('[C003]');
      expect(result).toContain('[C002]');
      expect(result).not.toContain('[C001]');
    });
  });

  describe('registry operations', () => {
    beforeEach(() => {
      writeFileSync(join(contextRoot, 'branches', '_registry.md'),
        '## Active Branch\nmain\n\n## Branch History\n| Branch | Status | Created |\n|--------|--------|---------|');
    });

    it('updates active branch', async () => {
      await updateRegistryActiveBranch(contextRoot, 'explore-x');
      const content = readFileSync(join(contextRoot, 'branches', '_registry.md'), 'utf-8');
      expect(content).toContain('## Active Branch\nexplore-x');
    });

    it('adds branch to registry history', async () => {
      await addBranchToRegistry(contextRoot, 'explore-x', '2026-02-26');
      const content = readFileSync(join(contextRoot, 'branches', '_registry.md'), 'utf-8');
      expect(content).toContain('| explore-x | active | 2026-02-26 |');
    });

    it('updates branch status in registry', async () => {
      await addBranchToRegistry(contextRoot, 'explore-x', '2026-02-26');
      await updateRegistryBranchStatus(contextRoot, 'explore-x', 'merged');
      const content = readFileSync(join(contextRoot, 'branches', '_registry.md'), 'utf-8');
      expect(content).toContain('| explore-x | merged |');
    });
  });

  describe('main.md branch list', () => {
    beforeEach(() => {
      writeFileSync(join(contextRoot, 'main.md'),
        '# Project\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- (none)\n');
    });

    it('adds branch to Open Branches', async () => {
      await addBranchToMainMd(contextRoot, 'explore-x');
      const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
      expect(content).toContain('- explore-x');
      expect(content).not.toContain('- (none)');
    });

    it('removes branch from Open Branches', async () => {
      await addBranchToMainMd(contextRoot, 'explore-x');
      await removeBranchFromMainMd(contextRoot, 'explore-x');
      const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
      expect(content).not.toContain('- explore-x');
      expect(content).toContain('- (none)');
    });
  });

  describe('branch header operations', () => {
    it('reads branch header', () => {
      mkdirSync(join(contextRoot, 'branches', 'explore-x'), { recursive: true });
      writeFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'),
        '# Branch: explore-x\n\n## Purpose\nTest purpose\n\n## Hypothesis\nTest hypo\n\n## Conclusion\n(Fill in at merge time — success/failure/partial)\n\n---\n\n# Milestone Journal\n\n## [C001] test');
      const header = getBranchHeader(contextRoot, 'explore-x');
      expect(header).toContain('Test purpose');
      expect(header).toContain('Test hypo');
      expect(header).not.toContain('[C001]');
    });

    it('updates branch conclusion', async () => {
      mkdirSync(join(contextRoot, 'branches', 'explore-x'), { recursive: true });
      writeFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'),
        '# Branch: explore-x\n\n## Conclusion\n(Fill in at merge time — success/failure/partial)\n\n---\n');
      await updateBranchConclusion(contextRoot, 'explore-x', 'success', 'It worked great');
      const content = readFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'), 'utf-8');
      expect(content).toContain('**Outcome**: success');
      expect(content).toContain('It worked great');
    });
  });

  describe('prependCommit — branch header handling', () => {
    it('inserts after Milestone Journal anchor in branch files', async () => {
      // Simulate a branch file created by ensureBranchDir
      const branchDir = join(contextRoot, 'branches', 'explore-x');
      mkdirSync(branchDir, { recursive: true });
      const branchCommits = `# Branch: explore-x

## Purpose
Test caching strategy

## Hypothesis
Redis will be faster

## Conclusion
(Fill in at merge time — success/failure/partial)

---

# Milestone Journal

`;
      writeFileSync(join(branchDir, 'commits.md'), branchCommits);

      await prependCommit(contextRoot, 'explore-x', '## [C001] 2026-02-26 | branch:explore-x | First commit\n**What**: Did something\n\n---\n\n');

      const content = readFileSync(join(branchDir, 'commits.md'), 'utf-8');
      // Commit must land AFTER "# Milestone Journal", not between title and Purpose
      const journalIdx = content.indexOf('# Milestone Journal');
      const commitIdx = content.indexOf('[C001]');
      const purposeIdx = content.indexOf('## Purpose');
      expect(commitIdx).toBeGreaterThan(journalIdx);
      expect(purposeIdx).toBeLessThan(journalIdx);
      // Verify header is intact
      expect(content).toContain('## Purpose\nTest caching strategy');
      expect(content).toContain('## Hypothesis\nRedis will be faster');
    });
  });

  describe('removeBranchFromMainMd — prefix matching', () => {
    it('does not remove prefix-similar branch names', async () => {
      writeFileSync(join(contextRoot, 'main.md'),
        '# Project\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- explore\n- explore-extended\n');

      await removeBranchFromMainMd(contextRoot, 'explore');
      const content = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
      expect(content).not.toContain('- explore\n');
      expect(content).toContain('- explore-extended');
    });
  });

  describe('appendLog', () => {
    it('appends to per-branch log', async () => {
      writeFileSync(join(contextRoot, 'branches', 'main', 'log.md'), '');
      await appendLog(contextRoot, 'main', '| 2026-01-01 | test | file.ts | OK |');
      const content = readFileSync(join(contextRoot, 'branches', 'main', 'log.md'), 'utf-8');
      expect(content).toContain('test');
    });

    it('creates branch dir if needed', async () => {
      await appendLog(contextRoot, 'new-branch', 'test log line');
      expect(existsSync(join(contextRoot, 'branches', 'new-branch', 'log.md'))).toBe(true);
    });
  });
});

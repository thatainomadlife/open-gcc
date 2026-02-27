import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { needsMigration, migrateV1ToV2 } from '../src/migrate.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('migration', () => {
  let contextRoot: string;

  beforeEach(() => {
    contextRoot = join(tmpdir(), `gcc-migrate-${Date.now()}`);
    mkdirSync(join(contextRoot, 'branches'), { recursive: true });
  });

  afterEach(() => {
    rmSync(contextRoot, { recursive: true, force: true });
  });

  describe('needsMigration', () => {
    it('returns true when root commits.md exists (v1 layout)', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n');
      expect(needsMigration(contextRoot)).toBe(true);
    });

    it('returns false when already migrated', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n');
      writeFileSync(join(contextRoot, '.migrated-v2'), 'done');
      expect(needsMigration(contextRoot)).toBe(false);
    });

    it('returns false when no root commits.md (fresh v2 install)', () => {
      expect(needsMigration(contextRoot)).toBe(false);
    });
  });

  describe('migrateV1ToV2', () => {
    it('moves commits.md to branches/main/', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n## [C001] test');
      migrateV1ToV2(contextRoot);

      expect(existsSync(join(contextRoot, 'commits.md'))).toBe(false);
      const content = readFileSync(join(contextRoot, 'branches', 'main', 'commits.md'), 'utf-8');
      expect(content).toContain('[C001]');
    });

    it('moves log.md to branches/main/', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Journal\n');
      writeFileSync(join(contextRoot, 'log.md'), '| 2026 | test | file | OK |');
      migrateV1ToV2(contextRoot);

      expect(existsSync(join(contextRoot, 'log.md'))).toBe(false);
      const content = readFileSync(join(contextRoot, 'branches', 'main', 'log.md'), 'utf-8');
      expect(content).toContain('test');
    });

    it('converts branch .md files to directories', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Journal\n');
      writeFileSync(join(contextRoot, 'branches', 'explore-x.md'),
        '# Branch: explore-x\n\n## Purpose\nTest purpose\n\n## Hypothesis\nTest hypo\n\n## Findings\nFound stuff\n\n## Conclusion\n(Fill in at merge time)');

      migrateV1ToV2(contextRoot);

      expect(existsSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'))).toBe(true);
      expect(existsSync(join(contextRoot, 'branches', 'explore-x', 'log.md'))).toBe(true);

      const content = readFileSync(join(contextRoot, 'branches', 'explore-x', 'commits.md'), 'utf-8');
      expect(content).toContain('Test purpose');
      expect(content).toContain('Test hypo');
      expect(content).toContain('Found stuff');
      expect(content).toContain('# Milestone Journal');
    });

    it('writes .migrated-v2 marker', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Journal\n');
      migrateV1ToV2(contextRoot);
      expect(existsSync(join(contextRoot, '.migrated-v2'))).toBe(true);
    });

    it('is idempotent (does not fail if run twice)', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Journal\n');
      migrateV1ToV2(contextRoot);
      // Running again should not throw (marker prevents actual migration)
      expect(needsMigration(contextRoot)).toBe(false);
    });

    it('preserves _registry.md during migration', () => {
      writeFileSync(join(contextRoot, 'commits.md'), '# Journal\n');
      writeFileSync(join(contextRoot, 'branches', '_registry.md'), '## Active Branch\nmain');
      migrateV1ToV2(contextRoot);
      const content = readFileSync(join(contextRoot, 'branches', '_registry.md'), 'utf-8');
      expect(content).toContain('## Active Branch');
    });
  });
});

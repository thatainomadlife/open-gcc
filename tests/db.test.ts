import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeFixture, type Fixture } from './helpers.js';

describe('GccDb', () => {
  let f: Fixture;
  beforeEach(() => { f = makeFixture(); });
  afterEach(() => { f.cleanup(); });

  describe('init', () => {
    it('creates schema and main branch on first open', () => {
      const main = f.db.getBranchByName('main');
      expect(main).not.toBeNull();
      expect(main!.status).toBe('active');
      expect(f.db.getActiveBranch().name).toBe('main');
    });
  });

  describe('branches', () => {
    it('creates an exploration branch', () => {
      const b = f.db.createBranch({
        name: 'explore-x',
        purpose: 'Try X',
        hypothesis: 'X is better',
      });
      expect(b.name).toBe('explore-x');
      expect(b.status).toBe('active');
      expect(b.purpose).toBe('Try X');
    });

    it('getBranchByName returns null for unknown branch', () => {
      expect(f.db.getBranchByName('ghost')).toBeNull();
    });

    it('listOpenBranches excludes main and merged branches', () => {
      f.db.createBranch({ name: 'a', purpose: 'p', hypothesis: 'h' });
      f.db.createBranch({ name: 'b', purpose: 'p', hypothesis: 'h' });
      f.db.updateBranchConclusion('b', { outcome: 'success', conclusion: 'done' });
      const open = f.db.listOpenBranches().map(b => b.name);
      expect(open).toEqual(['a']);
    });

    it('setActiveBranch switches context', () => {
      f.db.createBranch({ name: 'a', purpose: 'p', hypothesis: 'h' });
      f.db.setActiveBranch('a');
      expect(f.db.getActiveBranch().name).toBe('a');
      f.db.setActiveBranch('main');
      expect(f.db.getActiveBranch().name).toBe('main');
    });

    it('updateBranchConclusion sets outcome and status', () => {
      f.db.createBranch({ name: 'a', purpose: 'p', hypothesis: 'h' });
      f.db.updateBranchConclusion('a', {
        outcome: 'partial',
        conclusion: 'half worked',
        confidence: 'medium',
      });
      const b = f.db.getBranchByName('a')!;
      expect(b.outcome).toBe('partial');
      expect(b.status).toBe('merged');
      expect(b.conclusion).toBe('half worked');
      expect(b.confidence).toBe('medium');
      expect(b.merged_at).not.toBeNull();
    });
  });

  describe('commits', () => {
    it('commit IDs are project-global and monotonic', () => {
      const a = f.db.insertCommit({
        title: 'One', what: 'w', why: 'y', next_step: 'n', files: ['a'],
      });
      const b = f.db.insertCommit({
        title: 'Two', what: 'w', why: 'y', next_step: 'n', files: ['b'],
      });
      expect(a.commit_id).toBe('C001');
      expect(b.commit_id).toBe('C002');
    });

    it('persists files as a list', () => {
      const c = f.db.insertCommit({
        title: 'x', what: 'w', why: 'y', next_step: 'n',
        files: ['a.ts', 'b.ts', 'c.ts'],
      });
      expect(c.files).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });

    it('trims whitespace from file paths and drops empties', () => {
      const c = f.db.insertCommit({
        title: 'x', what: 'w', why: 'y', next_step: 'n',
        files: ['  a.ts  ', '', '   ', 'b.ts'],
      });
      expect(c.files).toEqual(['a.ts', 'b.ts']);
    });

    it('persists tags normalized to lowercase', () => {
      const c = f.db.insertCommit({
        title: 'x', what: 'w', why: 'y', next_step: 'n',
        files: ['a'],
        tags: ['Malware', 'HoneyPot', 'malware'],
      });
      expect(new Set(c.tags)).toEqual(new Set(['malware', 'honeypot']));
    });

    it('listRecentCommits returns newest first', () => {
      f.db.insertCommit({ title: 'a', what: 'w', why: 'y', next_step: 'n', files: ['a'] });
      f.db.insertCommit({ title: 'b', what: 'w', why: 'y', next_step: 'n', files: ['b'] });
      f.db.insertCommit({ title: 'c', what: 'w', why: 'y', next_step: 'n', files: ['c'] });
      const recent = f.db.listRecentCommits('main', 2);
      expect(recent.map(c => c.title)).toEqual(['c', 'b']);
    });

    it('listCommitsByTag filters correctly', () => {
      f.db.insertCommit({ title: 'a', what: 'w', why: 'y', next_step: 'n', files: ['a'], tags: ['malware'] });
      f.db.insertCommit({ title: 'b', what: 'w', why: 'y', next_step: 'n', files: ['b'], tags: ['infra'] });
      f.db.insertCommit({ title: 'c', what: 'w', why: 'y', next_step: 'n', files: ['c'], tags: ['malware'] });
      const results = f.db.listCommitsByTag('malware');
      expect(results.map(c => c.title).sort()).toEqual(['a', 'c']);
    });

    it('searchCommits finds by full-text match', () => {
      f.db.insertCommit({ title: 'fixed redis timeout', what: 'bumped to 10s', why: 'stability', next_step: 'deploy', files: ['cfg'] });
      f.db.insertCommit({ title: 'cleanup', what: 'removed dead code', why: 'readability', next_step: 'ship', files: ['x'] });
      const results = f.db.searchCommits('redis');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('redis');
    });
  });

  describe('logs', () => {
    it('appendLog records structured event', () => {
      f.db.appendLog({ event: 'tool-use', toolName: 'edit', summary: 'src/foo.ts' });
      const logs = f.db.listRecentLogs('main');
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe('tool-use');
      expect(logs[0].tool_name).toBe('edit');
    });

    it('appendLog stores JSON payload', () => {
      f.db.appendLog({
        event: 'task-completed',
        summary: 'task 12',
        payload: { task_id: '12', status: 'done' },
      });
      const logs = f.db.listRecentLogs('main');
      expect(JSON.parse(logs[0].payload_json!)).toEqual({ task_id: '12', status: 'done' });
    });

    it('countLogsSinceLastCommit counts only tool-use after last commit', () => {
      f.db.appendLog({ event: 'tool-use' });
      f.db.appendLog({ event: 'tool-use' });
      f.db.insertCommit({ title: 'x', what: 'w', why: 'y', next_step: 'n', files: ['a'] });
      f.db.appendLog({ event: 'tool-use' });
      f.db.appendLog({ event: 'session-start' });
      f.db.appendLog({ event: 'tool-use' });
      expect(f.db.countLogsSinceLastCommit('main')).toBe(2);
    });
  });

  describe('concurrency', () => {
    it('rapid appendLog calls never lose entries (race regression)', () => {
      const N = 200;
      for (let i = 0; i < N; i++) {
        f.db.appendLog({ event: 'tool-use', summary: `op-${i}` });
      }
      const logs = f.db.listRecentLogs('main', N + 10);
      expect(logs).toHaveLength(N);
    });
  });

  describe('project meta', () => {
    it('round-trips a value', () => {
      f.db.setMeta('current_focus', 'investigating X');
      expect(f.db.getMeta('current_focus')).toBe('investigating X');
    });
    it('returns null for missing keys', () => {
      expect(f.db.getMeta('nonexistent')).toBeNull();
    });
  });

  describe('stats', () => {
    it('reports counts accurately', () => {
      f.db.createBranch({ name: 'a', purpose: 'p', hypothesis: 'h' });
      f.db.insertCommit({ title: 'x', what: 'w', why: 'y', next_step: 'n', files: ['a'], branchName: 'a' });
      const s = f.db.getStats();
      expect(s.totalCommits).toBe(1);
      expect(s.totalBranches).toBe(2);
      expect(s.openBranches).toBe(1);
    });
  });
});

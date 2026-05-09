/**
 * GCC SQLite DB layer. Thin, typed wrapper around node:sqlite (Node >=22).
 *
 * The DB at .gcc/state.db is the source of truth. Markdown files under
 * .gcc/context/ are derived views rendered by src/db/render.ts.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA_SQL, SCHEMA_VERSION, type LogEvent } from './schema.js';

export interface Branch {
  id: number;
  name: string;
  purpose: string | null;
  hypothesis: string | null;
  conclusion: string | null;
  outcome: 'success' | 'failure' | 'partial' | 'inconclusive' | null;
  status: 'active' | 'merged' | 'abandoned';
  parent_id: number | null;
  created_at: string;
  merged_at: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  template: 'investigation' | 'feature' | 'incident' | 'refactor' | null;
  evidence_files: string | null;
}

export interface Commit {
  id: number;
  commit_id: string;
  branch_id: number;
  branch_name: string;
  ts: string;
  title: string;
  what: string;
  why: string;
  next_step: string;
  files: string[];
  tags: string[];
}

export interface LogRow {
  id: number;
  branch_id: number;
  branch_name: string;
  ts: string;
  event: LogEvent | string;
  tool_name: string | null;
  summary: string | null;
  payload_json: string | null;
}

export interface CommitInput {
  title: string;
  what: string;
  why: string;
  next_step: string;
  files: string[];
  tags?: string[];
  branchName?: string;
  /** ISO timestamp override — used by migration to preserve original times. */
  ts?: string;
}

export class GccDb {
  private db: DatabaseSync;

  constructor(public readonly path: string) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path);
    this.applyPragmas();
    this.initSchema();
  }

  /**
   * Apply per-connection PRAGMAs. Must run BEFORE schema/migrations.
   *
   * `journal_mode = WAL` returns a result row (the new mode), so it must be
   * run via prepare().get() — bundling it inside SCHEMA_SQL via exec() causes
   * it to silently no-op, leaving the DB in default rollback-journal mode,
   * which serialises all access and causes "database is locked" errors when
   * multiple Claude sessions or hooks contend for the same .gcc/state.db.
   *
   * WAL mode is persistent on the file (set once, sticks across opens).
   * busy_timeout / synchronous / foreign_keys are per-connection — must
   * be set every time.
   */
  private applyPragmas(): void {
    // ORDER MATTERS. busy_timeout must be set FIRST so subsequent PRAGMAs
    // (and any contended initSchema/migration) get retry protection.
    // Without this, journal_mode = WAL on a contended DB fails immediately
    // with "database is locked" before WAL can take effect.
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.prepare('PRAGMA journal_mode = WAL').get();
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
    const row = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined;
    if (!row) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
      this.ensureMainBranch();
    }
  }

  private ensureMainBranch(): void {
    const existing = this.db.prepare('SELECT id FROM branches WHERE name = ?').get('main');
    if (existing) return;
    const now = isoNow();
    const info = this.db.prepare(
      'INSERT INTO branches (name, status, created_at) VALUES (?, ?, ?)'
    ).run('main', 'active', now);
    const branchId = Number(info.lastInsertRowid);
    this.db.prepare('INSERT OR REPLACE INTO active_branch (id, branch_id) VALUES (1, ?)').run(branchId);
  }

  close(): void {
    this.db.close();
  }

  // -----------------------------------------------------------------------
  // Branches
  // -----------------------------------------------------------------------

  getBranchByName(name: string): Branch | null {
    const row = this.db.prepare('SELECT * FROM branches WHERE name = ?').get(name) as Branch | undefined;
    return row ?? null;
  }

  getBranchById(id: number): Branch | null {
    const row = this.db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as Branch | undefined;
    return row ?? null;
  }

  getActiveBranch(): Branch {
    const row = this.db.prepare(`
      SELECT b.* FROM active_branch a
      JOIN branches b ON b.id = a.branch_id
      WHERE a.id = 1
    `).get() as Branch | undefined;
    if (!row) {
      this.ensureMainBranch();
      return this.getBranchByName('main')!;
    }
    return row;
  }

  setActiveBranch(name: string): void {
    const branch = this.getBranchByName(name);
    if (!branch) throw new Error(`Branch not found: ${name}`);
    this.db.prepare('INSERT OR REPLACE INTO active_branch (id, branch_id) VALUES (1, ?)').run(branch.id);
  }

  createBranch(args: {
    name: string;
    purpose?: string;
    hypothesis?: string;
    parentName?: string;
    template?: Branch['template'];
  }): Branch {
    const parent = args.parentName ? this.getBranchByName(args.parentName) : this.getBranchByName('main');
    const now = isoNow();
    const info = this.db.prepare(`
      INSERT INTO branches (name, purpose, hypothesis, status, parent_id, created_at, template)
      VALUES (?, ?, ?, 'active', ?, ?, ?)
    `).run(args.name, args.purpose ?? null, args.hypothesis ?? null, parent?.id ?? null, now, args.template ?? null);
    return this.getBranchById(Number(info.lastInsertRowid))!;
  }

  listOpenBranches(): Branch[] {
    return this.db.prepare(`
      SELECT * FROM branches
      WHERE status = 'active' AND name != 'main'
      ORDER BY created_at DESC
    `).all() as unknown as Branch[];
  }

  listAllBranches(): Branch[] {
    return this.db.prepare('SELECT * FROM branches ORDER BY created_at ASC').all() as unknown as Branch[];
  }

  updateBranchConclusion(name: string, args: {
    outcome: Branch['outcome'];
    conclusion: string;
    confidence?: Branch['confidence'];
    evidenceFiles?: string[];
  }): void {
    const branch = this.getBranchByName(name);
    if (!branch) throw new Error(`Branch not found: ${name}`);
    this.db.prepare(`
      UPDATE branches
      SET outcome = ?, conclusion = ?, confidence = ?, evidence_files = ?,
          status = 'merged', merged_at = ?
      WHERE id = ?
    `).run(
      args.outcome,
      args.conclusion,
      args.confidence ?? null,
      args.evidenceFiles ? args.evidenceFiles.join('\n') : null,
      isoNow(),
      branch.id
    );
  }

  // -----------------------------------------------------------------------
  // Commits
  // -----------------------------------------------------------------------

  /**
   * Project-global monotonic commit ID: C001, C002, ... across all branches.
   */
  getNextCommitId(): string {
    const row = this.db.prepare('SELECT commit_id FROM commits ORDER BY id DESC LIMIT 1').get() as { commit_id: string } | undefined;
    if (!row) return 'C001';
    const match = row.commit_id.match(/^C(\d+)$/);
    if (!match) return 'C001';
    const next = parseInt(match[1], 10) + 1;
    return `C${String(next).padStart(Math.max(3, String(next).length), '0')}`;
  }

  insertCommit(input: CommitInput): Commit {
    const branchName = input.branchName ?? this.getActiveBranch().name;
    const branch = this.getBranchByName(branchName);
    if (!branch) throw new Error(`Branch not found: ${branchName}`);

    const commitId = this.getNextCommitId();
    const ts = input.ts ?? isoNow();

    const tx = this.db.prepare('BEGIN');
    tx.run();
    try {
      const info = this.db.prepare(`
        INSERT INTO commits (commit_id, branch_id, ts, title, what, why, next_step)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(commitId, branch.id, ts, input.title, input.what, input.why, input.next_step);
      const id = Number(info.lastInsertRowid);

      const insFile = this.db.prepare('INSERT OR IGNORE INTO commit_files (commit_id, path) VALUES (?, ?)');
      const seenPaths = new Set<string>();
      for (const raw of input.files) {
        const p = raw.trim();
        if (!p || seenPaths.has(p)) continue;
        seenPaths.add(p);
        insFile.run(id, p);
      }

      if (input.tags?.length) {
        const insTag = this.db.prepare('INSERT OR IGNORE INTO commit_tags (commit_id, tag) VALUES (?, ?)');
        for (const t of input.tags) {
          const tag = t.trim().toLowerCase();
          if (tag) insTag.run(id, tag);
        }
      }

      // Emit a 'commit' log entry atomically — anchors countLogsSinceLastCommit.
      this.db.prepare(`
        INSERT INTO logs (branch_id, ts, event, summary)
        VALUES (?, ?, 'commit', ?)
      `).run(branch.id, ts, `${commitId}: ${input.title}`);

      this.db.prepare('COMMIT').run();
    } catch (e) {
      this.db.prepare('ROLLBACK').run();
      throw e;
    }

    return this.getCommitById(commitId)!;
  }

  getCommitById(commitId: string): Commit | null {
    const row = this.db.prepare(`
      SELECT c.*, b.name AS branch_name
      FROM commits c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.commit_id = ?
    `).get(commitId) as Omit<Commit, 'files' | 'tags'> | undefined;
    if (!row) return null;
    return this.hydrateCommit(row);
  }

  listRecentCommits(branchName: string, limit = 3): Commit[] {
    const branch = this.getBranchByName(branchName);
    if (!branch) return [];
    const rows = this.db.prepare(`
      SELECT c.*, b.name AS branch_name
      FROM commits c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.branch_id = ?
      ORDER BY c.id DESC
      LIMIT ?
    `).all(branch.id, limit) as Omit<Commit, 'files' | 'tags'>[];
    return rows.map(r => this.hydrateCommit(r));
  }

  listRecentCommitsGlobal(limit = 5): Commit[] {
    const rows = this.db.prepare(`
      SELECT c.*, b.name AS branch_name
      FROM commits c
      JOIN branches b ON b.id = c.branch_id
      ORDER BY c.id DESC
      LIMIT ?
    `).all(limit) as Omit<Commit, 'files' | 'tags'>[];
    return rows.map(r => this.hydrateCommit(r));
  }

  listCommitsByBranch(branchName: string): Commit[] {
    const branch = this.getBranchByName(branchName);
    if (!branch) return [];
    const rows = this.db.prepare(`
      SELECT c.*, b.name AS branch_name
      FROM commits c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.branch_id = ?
      ORDER BY c.id DESC
    `).all(branch.id) as Omit<Commit, 'files' | 'tags'>[];
    return rows.map(r => this.hydrateCommit(r));
  }

  searchCommits(query: string, limit = 20): Commit[] {
    if (!query.trim()) return [];
    const rows = this.db.prepare(`
      SELECT c.*, b.name AS branch_name
      FROM commits_fts f
      JOIN commits c ON c.id = f.rowid
      JOIN branches b ON b.id = c.branch_id
      WHERE commits_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as Omit<Commit, 'files' | 'tags'>[];
    return rows.map(r => this.hydrateCommit(r));
  }

  listCommitsByTag(tag: string, limit = 50): Commit[] {
    const rows = this.db.prepare(`
      SELECT c.*, b.name AS branch_name
      FROM commits c
      JOIN commit_tags ct ON ct.commit_id = c.id
      JOIN branches b ON b.id = c.branch_id
      WHERE ct.tag = ?
      ORDER BY c.id DESC
      LIMIT ?
    `).all(tag.toLowerCase(), limit) as Omit<Commit, 'files' | 'tags'>[];
    return rows.map(r => this.hydrateCommit(r));
  }

  private hydrateCommit(row: Omit<Commit, 'files' | 'tags'>): Commit {
    const files = (this.db.prepare('SELECT path FROM commit_files WHERE commit_id = ? ORDER BY path').all(row.id) as { path: string }[]).map(r => r.path);
    const tags = (this.db.prepare('SELECT tag FROM commit_tags WHERE commit_id = ? ORDER BY tag').all(row.id) as { tag: string }[]).map(r => r.tag);
    return { ...row, files, tags };
  }

  // -----------------------------------------------------------------------
  // Logs
  // -----------------------------------------------------------------------

  appendLog(args: {
    branchName?: string;
    event: LogEvent | string;
    toolName?: string;
    summary?: string;
    payload?: Record<string, unknown>;
  }): void {
    const branchName = args.branchName ?? this.getActiveBranch().name;
    const branch = this.getBranchByName(branchName);
    if (!branch) return;
    this.db.prepare(`
      INSERT INTO logs (branch_id, ts, event, tool_name, summary, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      branch.id,
      isoNow(),
      args.event,
      args.toolName ?? null,
      args.summary ?? null,
      args.payload ? JSON.stringify(args.payload) : null
    );
  }

  listRecentLogs(branchName: string, limit = 500): LogRow[] {
    const branch = this.getBranchByName(branchName);
    if (!branch) return [];
    return this.db.prepare(`
      SELECT l.*, b.name AS branch_name
      FROM logs l JOIN branches b ON b.id = l.branch_id
      WHERE l.branch_id = ?
      ORDER BY l.id DESC
      LIMIT ?
    `).all(branch.id, limit) as unknown as LogRow[];
  }

  countLogsSinceLastCommit(branchName: string): number {
    const branch = this.getBranchByName(branchName);
    if (!branch) return 0;
    // Anchor by the last 'commit' log entry (inserted atomically with each commit).
    const lastCommitLog = this.db.prepare(
      "SELECT id FROM logs WHERE branch_id = ? AND event = 'commit' ORDER BY id DESC LIMIT 1"
    ).get(branch.id) as { id: number } | undefined;
    if (!lastCommitLog) {
      return (this.db.prepare('SELECT COUNT(*) AS c FROM logs WHERE branch_id = ? AND event = ?').get(branch.id, 'tool-use') as { c: number }).c;
    }
    return (this.db.prepare(
      "SELECT COUNT(*) AS c FROM logs WHERE branch_id = ? AND event = 'tool-use' AND id > ?"
    ).get(branch.id, lastCommitLog.id) as { c: number }).c;
  }

  pruneLogsForBranch(branchName: string, keepLast: number): void {
    const branch = this.getBranchByName(branchName);
    if (!branch) return;
    this.db.prepare(`
      DELETE FROM logs
      WHERE branch_id = ?
        AND id NOT IN (
          SELECT id FROM logs WHERE branch_id = ? ORDER BY id DESC LIMIT ?
        )
    `).run(branch.id, branch.id, keepLast);
  }

  // -----------------------------------------------------------------------
  // Project metadata
  // -----------------------------------------------------------------------

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM project_meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO project_meta (key, value) VALUES (?, ?)').run(key, value);
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  getStats(): {
    totalCommits: number;
    totalBranches: number;
    openBranches: number;
    activeBranch: string;
    lastCommitTs: string | null;
  } {
    const totalCommits = (this.db.prepare('SELECT COUNT(*) AS c FROM commits').get() as { c: number }).c;
    const totalBranches = (this.db.prepare('SELECT COUNT(*) AS c FROM branches').get() as { c: number }).c;
    const openBranches = (this.db.prepare("SELECT COUNT(*) AS c FROM branches WHERE status = 'active' AND name != 'main'").get() as { c: number }).c;
    const activeBranch = this.getActiveBranch().name;
    const last = this.db.prepare('SELECT ts FROM commits ORDER BY id DESC LIMIT 1').get() as { ts: string } | undefined;
    return { totalCommits, totalBranches, openBranches, activeBranch, lastCommitTs: last?.ts ?? null };
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Open a GCC DB at .gcc/state.db under the given GCC root directory.
 */
export function openDb(gccRoot: string): GccDb {
  return new GccDb(`${gccRoot}/state.db`);
}

/**
 * GCC v3 context API — DB-backed, markdown-rendered.
 *
 * All operations go through SQLite (source of truth). Markdown views under
 * .gcc/context/ are regenerated on every mutation by src/db/render.ts.
 *
 * Hooks and MCP handlers use `withDb(gccRoot, fn)` to open a short-lived
 * DB connection and run work inside it. Rendering is automatic on write ops
 * — call `renderAll(db, contextRoot)` after mutations if you bypass these
 * helpers.
 */

import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { openDb, type GccDb, type Commit, type Branch } from './db/index.js';
import { renderAll } from './db/render.js';
import { migrateV2ToV3 } from './db/migrate-v3.js';
import type { LogEvent } from './db/schema.js';

export type { Commit, Branch } from './db/index.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function getContextDir(gccRoot: string): string {
  return join(gccRoot, 'context');
}

export function getBranchDir(contextRoot: string, branch: string): string {
  return join(contextRoot, 'branches', branch);
}

export function getCommitsPath(contextRoot: string, branch: string): string {
  return join(contextRoot, 'branches', branch, 'commits.md');
}

export function getLogPath(contextRoot: string, branch: string): string {
  return join(contextRoot, 'branches', branch, 'log.md');
}

// ---------------------------------------------------------------------------
// DB session wrapper
// ---------------------------------------------------------------------------

/**
 * Open a DB, run fn, render markdown, close.
 * Migrates v2 markdown data on first open.
 */
export async function withDb<T>(gccRoot: string, fn: (db: GccDb) => Promise<T>): Promise<T> {
  const db = openDb(gccRoot);
  try {
    migrateV2ToV3(db, gccRoot);
    const result = await fn(db);
    await renderAll(db, getContextDir(gccRoot));
    return result;
  } finally {
    db.close();
  }
}

/**
 * Read-only DB access — no render step.
 */
export function withDbRead<T>(gccRoot: string, fn: (db: GccDb) => T): T {
  const db = openDb(gccRoot);
  try {
    migrateV2ToV3(db, gccRoot);
    return fn(db);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// High-level operations (used by MCP handlers)
// ---------------------------------------------------------------------------

export interface InsertCommitArgs {
  title: string;
  what: string;
  why: string;
  next_step: string;
  files: string[];
  tags?: string[];
  branchName?: string;
}

export async function insertCommit(gccRoot: string, args: InsertCommitArgs): Promise<Commit> {
  // db.insertCommit already writes an atomic 'commit' log entry.
  return withDb(gccRoot, async (db) => db.insertCommit(args));
}

export async function createBranch(gccRoot: string, args: {
  name: string;
  purpose: string;
  hypothesis: string;
  template?: Branch['template'];
}): Promise<Branch> {
  return withDb(gccRoot, async (db) => {
    const branch = db.createBranch(args);
    db.setActiveBranch(branch.name);
    db.appendLog({
      branchName: branch.name,
      event: 'branch-create',
      summary: `Created branch ${branch.name}${args.template ? ` [${args.template}]` : ''}: ${args.purpose}`,
    });
    return branch;
  });
}

export async function mergeBranch(gccRoot: string, args: {
  branchName: string;
  outcome: 'success' | 'failure' | 'partial';
  conclusion: string;
  confidence?: 'high' | 'medium' | 'low';
  evidenceFiles?: string[];
}): Promise<Commit> {
  return withDb(gccRoot, async (db) => {
    db.updateBranchConclusion(args.branchName, {
      outcome: args.outcome,
      conclusion: args.conclusion,
      confidence: args.confidence,
      evidenceFiles: args.evidenceFiles,
    });

    const commit = db.insertCommit({
      branchName: 'main',
      title: `Merge: ${args.branchName} (${args.outcome})`,
      what: `Merged exploration branch '${args.branchName}'. ${args.conclusion}`,
      why: 'Consolidate findings from exploration.',
      files: [`.gcc/context/branches/${args.branchName}/`],
      next_step: 'Continue on main with findings applied.',
    });

    db.setActiveBranch('main');
    db.appendLog({
      branchName: args.branchName,
      event: 'branch-merge',
      summary: `MERGE ${args.outcome}: ${args.conclusion}`,
    });
    db.appendLog({
      branchName: 'main',
      event: 'branch-merge',
      summary: `Merged ${args.branchName} (${args.outcome}) as ${commit.commit_id}`,
    });
    return commit;
  });
}

// ---------------------------------------------------------------------------
// Hook-oriented logging — lightweight, fire-and-forget
// ---------------------------------------------------------------------------

/**
 * Append a log entry for hook events. Opens DB, logs, closes.
 * Skips rendering (hooks are hot-path). Markdown catches up on next write op.
 */
export function logHookEvent(gccRoot: string, args: {
  event: LogEvent | string;
  toolName?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  branchName?: string;
}): void {
  const start = process.env.GCC_DEBUG === '1' ? Date.now() : 0;
  const db = openDb(gccRoot);
  try {
    migrateV2ToV3(db, gccRoot);
    db.appendLog(args);
  } finally {
    db.close();
  }
  if (start) {
    const duration = Date.now() - start;
    process.stderr.write(`[gcc-debug ${new Date().toISOString().slice(11, 23)} pid=${process.pid}] hook event=${args.event}${args.toolName ? ` tool=${args.toolName}` : ''} ${duration}ms\n`);
  }
}

// ---------------------------------------------------------------------------
// Read helpers (preserved for MCP handlers + hooks)
// ---------------------------------------------------------------------------

export function getActiveBranchName(gccRoot: string): string {
  return withDbRead(gccRoot, (db) => db.getActiveBranch().name);
}

export function readMainMarkdown(gccRoot: string): string | null {
  try {
    const path = join(getContextDir(gccRoot), 'main.md');
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

export function getRecentCommits(gccRoot: string, branch: string, count: number): Commit[] {
  return withDbRead(gccRoot, (db) => db.listRecentCommits(branch, count));
}

#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
/**
 * gcc — command-line interface for inspecting GCC state.
 *
 * Thin wrapper over the DB API. Opens .gcc/state.db in the current project
 * (CLAUDE_PROJECT_DIR or cwd) and runs read-only queries.
 *
 * Subcommands: status, log, search, commits, tags, branches, export, help.
 */

import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDb, type Commit } from '../db/index.js';

type SubcommandHandler = (args: string[]) => Promise<void> | void;

const SUBCOMMANDS: Record<string, SubcommandHandler> = {
  status: cmdStatus,
  log: cmdLog,
  search: cmdSearch,
  commits: cmdCommits,
  tags: cmdTags,
  branches: cmdBranches,
  export: cmdExport,
  help: cmdHelp,
  '--help': cmdHelp,
  '-h': cmdHelp,
};

async function main(): Promise<void> {
  const [, , sub, ...rest] = process.argv;
  const handler = sub ? SUBCOMMANDS[sub] : cmdHelp;
  if (!handler) {
    process.stderr.write(`Unknown subcommand: ${sub}\n\n`);
    cmdHelp([]);
    process.exit(2);
  }
  try {
    await handler(rest);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`gcc: ${msg}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// GCC root resolution
// ---------------------------------------------------------------------------

function resolveGccRoot(override?: string): string {
  // Accept either a project directory (contains .gcc/) or the .gcc dir itself.
  const candidates: string[] = [];
  if (override) {
    candidates.push(resolve(override));
    candidates.push(join(resolve(override), '.gcc'));
  } else {
    const base = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    candidates.push(join(resolve(base), '.gcc'));
  }
  for (const c of candidates) {
    if (existsSync(join(c, 'state.db'))) return c;
  }
  throw new Error(`no state.db found — tried: ${candidates.join(', ')}`);
}

function withDb<T>(override: string | undefined, fn: (db: ReturnType<typeof openDb>) => T): T {
  const db = openDb(resolveGccRoot(override));
  try { return fn(db); } finally { db.close(); }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const COLOR = process.stdout.isTTY ? {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
} : {
  dim: (s: string) => s,
  bold: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  cyan: (s: string) => s,
};

function formatTs(iso: string, full = false): string {
  return full ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10);
}

function formatCommit(c: Commit, verbose = false): string {
  const header = `${COLOR.bold(COLOR.cyan(c.commit_id))} ${COLOR.dim(formatTs(c.ts, true))} ${COLOR.dim(`[${c.branch_name}]`)} ${c.title}`;
  if (!verbose) return header;
  const parts = [header, `  ${COLOR.dim('What:')} ${c.what}`, `  ${COLOR.dim('Why:')}  ${c.why}`];
  if (c.files.length) parts.push(`  ${COLOR.dim('Files:')} ${c.files.join(', ')}`);
  if (c.tags.length) parts.push(`  ${COLOR.dim('Tags:')}  ${c.tags.join(', ')}`);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdStatus(args: string[]): void {
  const { values } = parseArgs({ args, options: { 'gcc-root': { type: 'string' } }, allowPositionals: true });
  withDb(values['gcc-root'], (db) => {
    const s = db.getStats();
    const active = db.getActiveBranch();
    const lastCommit = db.listRecentCommits(active.name, 1)[0];
    const toolCount = db.countLogsSinceLastCommit(active.name);
    const openBranches = db.listOpenBranches().map(b => b.name);

    process.stdout.write(`${COLOR.bold('GCC Status')}\n`);
    process.stdout.write(`  Active branch:  ${COLOR.cyan(active.name)}\n`);
    process.stdout.write(`  Last commit:    ${lastCommit ? `${COLOR.cyan(lastCommit.commit_id)} ${COLOR.dim(formatTs(lastCommit.ts, true))} ${lastCommit.title}` : COLOR.dim('(none)')}\n`);
    process.stdout.write(`  Tool ops since: ${toolCount}\n`);
    process.stdout.write(`  Open branches:  ${openBranches.length > 0 ? openBranches.join(', ') : COLOR.dim('(none)')}\n`);
    process.stdout.write(`  Total commits:  ${s.totalCommits}\n`);

    const errSummary = readErrorSummary(resolveGccRoot(values['gcc-root']));
    if (errSummary.count24h > 0) {
      process.stdout.write(`  ${COLOR.yellow(`Hook errors (24h): ${errSummary.count24h}`)} — last: ${errSummary.lastTs ?? 'unknown'}\n`);
    }
  });
}

function cmdLog(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      'gcc-root': { type: 'string' },
      branch: { type: 'string', short: 'b' },
      limit: { type: 'string', short: 'n', default: '50' },
    },
    allowPositionals: true,
  });
  withDb(values['gcc-root'], (db) => {
    const branch = values.branch ?? db.getActiveBranch().name;
    const limit = parseInt(values.limit as string, 10);
    const logs = db.listRecentLogs(branch, limit);
    if (logs.length === 0) {
      process.stdout.write(COLOR.dim('(no logs)\n'));
      return;
    }
    for (const l of logs.reverse()) {
      const ts = COLOR.dim(formatTs(l.ts, true));
      const event = colorizeEvent(l.event);
      const tool = l.tool_name ? ` ${COLOR.cyan(l.tool_name)}` : '';
      const summary = l.summary ? ` ${COLOR.dim('—')} ${l.summary}` : '';
      process.stdout.write(`${ts}  ${event}${tool}${summary}\n`);
    }
  });
}

function cmdSearch(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    options: {
      'gcc-root': { type: 'string' },
      tag: { type: 'string', short: 't' },
      branch: { type: 'string', short: 'b' },
      limit: { type: 'string', short: 'n', default: '10' },
      verbose: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
  });
  const query = positionals.join(' ');
  if (!query.trim()) {
    process.stderr.write('gcc search: query required\n');
    process.exit(2);
  }
  withDb(values['gcc-root'], (db) => {
    const limit = parseInt(values.limit as string, 10);
    let results = values.tag ? db.listCommitsByTag(values.tag) : db.searchCommits(query, limit);
    if (values.tag) {
      const lower = query.toLowerCase();
      results = results.filter(c =>
        c.title.toLowerCase().includes(lower) ||
        c.what.toLowerCase().includes(lower) ||
        c.why.toLowerCase().includes(lower)
      );
    }
    if (values.branch) {
      results = results.filter(c => c.branch_name === values.branch);
    }
    results = results.slice(0, limit);
    if (results.length === 0) {
      process.stdout.write(COLOR.dim(`(no matches for "${query}")\n`));
      return;
    }
    for (const c of results) {
      process.stdout.write(`${formatCommit(c, values.verbose)}\n`);
    }
  });
}

function cmdCommits(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      'gcc-root': { type: 'string' },
      branch: { type: 'string', short: 'b' },
      limit: { type: 'string', short: 'n', default: '20' },
      verbose: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
  });
  withDb(values['gcc-root'], (db) => {
    const branch = values.branch ?? db.getActiveBranch().name;
    const limit = parseInt(values.limit as string, 10);
    const commits = db.listRecentCommits(branch, limit);
    if (commits.length === 0) {
      process.stdout.write(COLOR.dim(`(no commits on ${branch})\n`));
      return;
    }
    for (const c of commits) {
      process.stdout.write(`${formatCommit(c, values.verbose)}\n`);
    }
  });
}

function cmdTags(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { 'gcc-root': { type: 'string' } },
    allowPositionals: true,
  });
  withDb(values['gcc-root'], (db) => {
    // Count tag frequencies via raw SQL
    const rows = (db as any).db.prepare(`
      SELECT tag, COUNT(*) AS c FROM commit_tags GROUP BY tag ORDER BY c DESC, tag ASC
    `).all() as { tag: string; c: number }[];
    if (rows.length === 0) {
      process.stdout.write(COLOR.dim('(no tags)\n'));
      return;
    }
    const maxLen = Math.max(...rows.map(r => r.tag.length));
    for (const r of rows) {
      process.stdout.write(`  ${r.tag.padEnd(maxLen + 2)} ${COLOR.dim(`${r.c}`)}\n`);
    }
  });
}

function cmdBranches(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      'gcc-root': { type: 'string' },
      all: { type: 'boolean', short: 'a' },
    },
    allowPositionals: true,
  });
  withDb(values['gcc-root'], (db) => {
    const branches = values.all ? db.listAllBranches() : [db.getBranchByName('main')!, ...db.listOpenBranches()];
    for (const b of branches) {
      if (!b) continue;
      const status = colorizeStatus(b.status);
      const tmpl = b.template ? ` ${COLOR.dim(`[${b.template}]`)}` : '';
      const outcome = b.outcome ? ` ${COLOR.dim('→')} ${colorizeOutcome(b.outcome)}` : '';
      process.stdout.write(`  ${COLOR.cyan(b.name.padEnd(36))} ${status}${tmpl}${outcome}\n`);
    }
  });
}

function cmdExport(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: {
      'gcc-root': { type: 'string' },
      branch: { type: 'string', short: 'b' },
      since: { type: 'string' },
      format: { type: 'string', default: 'markdown' },
    },
    allowPositionals: true,
  });
  withDb(values['gcc-root'], (db) => {
    const branch = values.branch ?? 'main';
    let commits = db.listCommitsByBranch(branch);
    if (values.since) {
      const cutoff = parseSince(values.since);
      commits = commits.filter(c => new Date(c.ts).getTime() >= cutoff);
    }
    if (values.format === 'json') {
      process.stdout.write(JSON.stringify(commits, null, 2) + '\n');
      return;
    }
    const lines: string[] = [`# Commits from branch:${branch}`, ''];
    for (const c of commits) {
      lines.push(`## [${c.commit_id}] ${formatTs(c.ts, true)} | ${c.title}`);
      lines.push(`**What**: ${c.what}`);
      lines.push(`**Why**: ${c.why}`);
      if (c.files.length) lines.push(`**Files**: ${c.files.join(', ')}`);
      if (c.tags.length) lines.push(`**Tags**: ${c.tags.join(', ')}`);
      lines.push(`**Next**: ${c.next_step}`);
      lines.push('');
    }
    process.stdout.write(lines.join('\n'));
  });
}

function cmdHelp(_args: string[]): void {
  const text = `gcc — GCC (Git Context Chain) command-line interface

USAGE:
  gcc <subcommand> [options]

SUBCOMMANDS:
  status                     Quick status of active branch + recent work
  log [-b <branch>] [-n <N>] Recent hook event log (default: active branch, 50)
  search <query> [-t <tag>] [-b <branch>] [-n <N>] [-v]
                             Full-text search across commits (SQLite FTS5)
  commits [-b <branch>] [-n <N>] [-v]
                             List commits (default: active branch, last 20)
  tags                       Tag frequency table
  branches [-a]              List branches (use -a for merged/abandoned too)
  export [-b <branch>] [--since 7d] [--format markdown|json]
                             Dump commits as markdown (default) or JSON

GLOBAL OPTIONS:
  --gcc-root <path>          Override project root (default: CLAUDE_PROJECT_DIR or cwd)
  -h, --help                 Show this help

EXAMPLES:
  gcc status
  gcc log -n 20
  gcc search "honeypot AND mirai"
  gcc search redis -t infra -v
  gcc commits -b gcc-phase1 -v
  gcc export --since 30d --format json > commits.json
`;
  process.stdout.write(text);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colorizeEvent(event: string): string {
  if (event === 'commit') return COLOR.green(event);
  if (event.includes('failure') || event === 'stop-failure') return COLOR.red(event);
  if (event.includes('branch') || event.includes('merge')) return COLOR.cyan(event);
  return COLOR.dim(event);
}

function colorizeStatus(status: string): string {
  if (status === 'active') return COLOR.green(status);
  if (status === 'merged') return COLOR.dim(status);
  return COLOR.yellow(status);
}

function colorizeOutcome(outcome: string): string {
  if (outcome === 'success') return COLOR.green(outcome);
  if (outcome === 'failure') return COLOR.red(outcome);
  return COLOR.yellow(outcome);
}

function parseSince(raw: string): number {
  const match = raw.match(/^(\d+)([dhm])$/);
  if (!match) throw new Error(`invalid --since value: ${raw} (use Nd / Nh / Nm)`);
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const ms = unit === 'd' ? n * 86400_000 : unit === 'h' ? n * 3600_000 : n * 60_000;
  return Date.now() - ms;
}

interface ErrorSummary {
  count24h: number;
  lastTs: string | null;
}

function readErrorSummary(gccRoot: string): ErrorSummary {
  const path = join(gccRoot, 'error.log');
  if (!existsSync(path)) return { count24h: 0, lastTs: null };
  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const cutoff = Date.now() - 24 * 3600_000;
    let count = 0;
    let lastTs: string | null = null;
    for (const line of lines) {
      const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
      if (!m) continue;
      const ts = new Date(m[1].replace(' ', 'T') + 'Z').getTime();
      if (ts >= cutoff) {
        count++;
        lastTs = m[1];
      }
    }
    return { count24h: count, lastTs };
  } catch {
    return { count24h: 0, lastTs: null };
  }
}

main();

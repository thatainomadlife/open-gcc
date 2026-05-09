/**
 * v2 (markdown) → v3 (SQLite) migration.
 *
 * Reads .gcc/context/{main.md, branches/_registry.md, branches/*\/commits.md, branches/*\/log.md}
 * and populates state.db. Markdown files are left in place (and will be overwritten
 * by render.ts on next write); pre-migration snapshot is saved to .gcc/context.v2-backup/.
 *
 * Idempotent via schema_version check: if DB already has version >= 3, migration skips.
 */

import { existsSync, readFileSync, readdirSync, statSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import type { GccDb } from './index.js';

export interface MigrationReport {
  migrated: boolean;
  branches: number;
  commits: number;
  logs: number;
  skipped?: string;
}

export function migrateV2ToV3(db: GccDb, gccRoot: string): MigrationReport {
  const contextRoot = join(gccRoot, 'context');

  if (!existsSync(contextRoot)) {
    return { migrated: false, branches: 0, commits: 0, logs: 0, skipped: 'no context dir' };
  }

  const stats = db.getStats();
  if (stats.totalCommits > 0 || stats.totalBranches > 1) {
    return { migrated: false, branches: 0, commits: 0, logs: 0, skipped: 'db already populated' };
  }

  backupV2(contextRoot, gccRoot);

  const branchCount = migrateBranches(db, contextRoot);
  const commitCount = migrateCommits(db, contextRoot);
  const logCount = migrateLogs(db, contextRoot);
  migrateActiveBranch(db, contextRoot);
  migrateFocus(db, contextRoot);

  return { migrated: true, branches: branchCount, commits: commitCount, logs: logCount };
}

function backupV2(contextRoot: string, gccRoot: string): void {
  const backupDir = join(gccRoot, 'context.v2-backup');
  if (existsSync(backupDir)) return;
  cpSync(contextRoot, backupDir, { recursive: true });
}

function migrateBranches(db: GccDb, contextRoot: string): number {
  const branchesDir = join(contextRoot, 'branches');
  if (!existsSync(branchesDir)) return 0;

  const entries = readdirSync(branchesDir);
  let count = 0;

  for (const entry of entries) {
    const full = join(branchesDir, entry);
    if (entry === '_registry.md' || !statSync(full).isDirectory()) continue;
    if (entry === 'main') continue;

    const existing = db.getBranchByName(entry);
    if (existing) continue;

    const commitsPath = join(full, 'commits.md');
    const header = existsSync(commitsPath) ? parseHeader(readFileSync(commitsPath, 'utf-8')) : {};

    db.createBranch({
      name: entry,
      purpose: header.purpose,
      hypothesis: header.hypothesis,
    });

    if (header.conclusion && !header.conclusion.includes('Fill in at merge time')) {
      db.updateBranchConclusion(entry, {
        outcome: header.outcome ?? 'partial',
        conclusion: header.conclusion,
      });
    }
    count++;
  }

  // Registry history can list merged/abandoned branches that have no remaining dir —
  // capture those too so history is preserved.
  const registryPath = join(branchesDir, '_registry.md');
  if (existsSync(registryPath)) {
    const rows = parseRegistryRows(readFileSync(registryPath, 'utf-8'));
    for (const row of rows) {
      if (row.name === 'main') continue;
      if (db.getBranchByName(row.name)) continue;
      db.createBranch({ name: row.name });
      if (row.status === 'merged' || row.status === 'abandoned') {
        db.updateBranchConclusion(row.name, {
          outcome: row.status === 'merged' ? 'success' : 'failure',
          conclusion: '(migrated — no conclusion recorded)',
        });
      }
      count++;
    }
  }

  return count;
}

function migrateCommits(db: GccDb, contextRoot: string): number {
  const branchesDir = join(contextRoot, 'branches');
  if (!existsSync(branchesDir)) return 0;

  const entries = readdirSync(branchesDir);
  const allCommits: Array<{ branchName: string; commit: ParsedCommit }> = [];

  for (const entry of entries) {
    const full = join(branchesDir, entry);
    if (entry === '_registry.md' || !statSync(full).isDirectory()) continue;

    const commitsPath = join(full, 'commits.md');
    if (!existsSync(commitsPath)) continue;

    const parsed = parseCommits(readFileSync(commitsPath, 'utf-8'));
    for (const c of parsed) allCommits.push({ branchName: entry, commit: c });
  }

  allCommits.sort((a, b) => {
    const na = extractCommitNumber(a.commit.commit_id);
    const nb = extractCommitNumber(b.commit.commit_id);
    return na - nb;
  });

  let count = 0;
  for (const { branchName, commit } of allCommits) {
    db.insertCommit({
      branchName,
      title: commit.title,
      what: commit.what,
      why: commit.why,
      next_step: commit.next,
      files: commit.files,
      tags: commit.tags,
      ts: commit.ts,
    });
    count++;
  }
  return count;
}

function migrateLogs(db: GccDb, contextRoot: string): number {
  const branchesDir = join(contextRoot, 'branches');
  if (!existsSync(branchesDir)) return 0;

  const entries = readdirSync(branchesDir);
  let count = 0;

  for (const entry of entries) {
    const full = join(branchesDir, entry);
    if (entry === '_registry.md' || !statSync(full).isDirectory()) continue;

    const logPath = join(full, 'log.md');
    if (!existsSync(logPath)) continue;

    const lines = readFileSync(logPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('|---') || trimmed.startsWith('| timestamp')) continue;
      const parsed = parseLogLine(trimmed);
      if (!parsed) continue;
      db.appendLog({
        branchName: entry,
        event: parsed.event,
        toolName: parsed.tool,
        summary: parsed.summary,
      });
      count++;
    }
  }
  return count;
}

function migrateActiveBranch(db: GccDb, contextRoot: string): void {
  const registryPath = join(contextRoot, 'branches', '_registry.md');
  if (!existsSync(registryPath)) return;
  const content = readFileSync(registryPath, 'utf-8');
  const match = content.match(/## Active Branch\s*\n([^\n]+)/);
  if (!match) return;
  const name = match[1].trim();
  const branch = db.getBranchByName(name);
  if (branch) db.setActiveBranch(name);
}

function migrateFocus(db: GccDb, contextRoot: string): void {
  const mainPath = join(contextRoot, 'main.md');
  if (!existsSync(mainPath)) return;
  const content = readFileSync(mainPath, 'utf-8');
  const section = extractSection(content, 'Current Focus');
  if (section && !section.includes('Auto-created')) {
    db.setMeta('current_focus', section);
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

interface ParsedHeader {
  purpose?: string;
  hypothesis?: string;
  conclusion?: string;
  outcome?: 'success' | 'failure' | 'partial' | 'inconclusive';
}

function parseHeader(content: string): ParsedHeader {
  const result: ParsedHeader = {};
  const purpose = extractSection(content, 'Purpose');
  const hypothesis = extractSection(content, 'Hypothesis');
  const conclusion = extractSection(content, 'Conclusion');
  if (purpose) result.purpose = purpose;
  if (hypothesis) result.hypothesis = hypothesis;
  if (conclusion) {
    result.conclusion = conclusion;
    const outcomeMatch = conclusion.match(/\*\*Outcome\*\*:\s*(success|failure|partial|inconclusive)/i);
    if (outcomeMatch) result.outcome = outcomeMatch[1].toLowerCase() as ParsedHeader['outcome'];
  }
  return result;
}

function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---|\\n# |$)`);
  const match = content.match(regex);
  if (!match) return null;
  const text = match[1].trim();
  return text || null;
}

interface ParsedCommit {
  commit_id: string;
  ts: string;
  title: string;
  what: string;
  why: string;
  files: string[];
  next: string;
  tags: string[];
}

function parseCommits(content: string): ParsedCommit[] {
  const results: ParsedCommit[] = [];
  const blocks = content.split(/(?=^## \[C\d+\])/m);
  for (const block of blocks) {
    if (!block.startsWith('## [C')) continue;
    const parsed = parseCommitBlock(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

function parseCommitBlock(block: string): ParsedCommit | null {
  const header = block.match(/^## \[(C\d+)\]\s+([^|]+?)\s*\|\s*branch:[^|]+\|\s*(.+)$/m);
  if (!header) return null;

  const commit_id = header[1];
  const ts = parseTimestamp(header[2].trim());
  const title = header[3].trim();

  const what = extractBold(block, 'What') ?? '';
  const why = extractBold(block, 'Why') ?? '';
  const next = extractBold(block, 'Next') ?? '';
  const filesRaw = extractBold(block, 'Files') ?? '';
  const tagsRaw = extractBold(block, 'Tags') ?? '';

  const files = filesRaw
    .split(',')
    .map(s => s.trim())
    .filter(s => s && s !== '(none)');
  const tags = tagsRaw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  return { commit_id, ts, title, what, why, next, files, tags };
}

function extractBold(block: string, label: string): string | null {
  const regex = new RegExp(`\\*\\*${label}\\*\\*:\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n---|\\n##|$)`);
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function parseTimestamp(raw: string): string {
  // Accepts "2026-04-11 17:42" or "2026-04-11" or already ISO.
  const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  if (!isoMatch) return new Date().toISOString();
  const datePart = isoMatch[1];
  const timePart = isoMatch[2] ?? '00:00:00';
  const normalized = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${datePart}T${normalized}.000Z`;
}

function extractCommitNumber(commitId: string): number {
  const match = commitId.match(/^C(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

interface ParsedRegistryRow {
  name: string;
  status: string;
  created: string;
}

function parseRegistryRows(content: string): ParsedRegistryRow[] {
  const rows: ParsedRegistryRow[] = [];
  const lines = content.split('\n');
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('|--')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { inTable = false; continue; }
    const cells = line.split('|').map(s => s.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    rows.push({ name: cells[0], status: cells[1], created: cells[2] });
  }
  return rows;
}

interface ParsedLogLine {
  event: string;
  tool?: string;
  summary?: string;
}

function parseLogLine(line: string): ParsedLogLine | null {
  // Legacy log format varies — try the pipe-table form first, fall back to free text.
  if (line.startsWith('|')) {
    const cells = line.split('|').map(s => s.trim()).filter(Boolean);
    if (cells.length >= 2) {
      return {
        event: cells[1] || 'tool-use',
        tool: cells[2] || undefined,
        summary: cells.slice(3).join(' | ') || undefined,
      };
    }
  }
  return { event: 'legacy', summary: line.slice(0, 200) };
}

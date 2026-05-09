/**
 * gcc_status handler — lightweight "where am I?" status check.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withDbRead } from '../../context.js';
import { getGCCRoot } from './shared.js';

export interface StatusArgs {}

export async function handleStatus(contextRoot: string, _args: StatusArgs): Promise<string> {
  const gccRoot = getGCCRoot(contextRoot);

  const snapshot = withDbRead(gccRoot, (db) => {
    const active = db.getActiveBranch();
    const lastCommit = db.listRecentCommits(active.name, 1)[0] ?? null;
    const toolCount = db.countLogsSinceLastCommit(active.name);
    const openBranches = db.listOpenBranches().map(b => b.name);
    return { active, lastCommit, toolCount, openBranches };
  });

  const parts: string[] = [];
  parts.push('## GCC Status');
  parts.push(`**Active branch**: ${snapshot.active.name}`);

  if (snapshot.lastCommit) {
    const ts = snapshot.lastCommit.ts.slice(0, 16).replace('T', ' ');
    parts.push(`**Last commit**: ${snapshot.lastCommit.commit_id} — ${snapshot.lastCommit.title} (${ts})`);
    parts.push(`**Time since last commit**: ${timeAgo(snapshot.lastCommit.ts)}`);
  } else {
    parts.push('**Last commit**: (none)');
  }

  parts.push(`**Tool operations since last commit**: ${snapshot.toolCount}`);
  parts.push(`**Open branches**: ${snapshot.openBranches.length > 0 ? snapshot.openBranches.join(', ') : '(none)'}`);

  const errSummary = readErrorSummary(gccRoot);
  if (errSummary.count24h > 0) {
    parts.push(`**Hook errors (24h)**: ${errSummary.count24h}${errSummary.lastTs ? ` — last: ${errSummary.lastTs}` : ''}`);
  }

  return parts.join('\n');
}

function timeAgo(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return 'unknown';
  }
}

function readErrorSummary(gccRoot: string): { count24h: number; lastTs: string | null } {
  const path = join(gccRoot, 'error.log');
  if (!existsSync(path)) return { count24h: 0, lastTs: null };
  try {
    const lines = readFileSync(path, 'utf-8').split('\n').filter(l => l.trim());
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

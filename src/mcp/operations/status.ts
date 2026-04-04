/**
 * gcc_status handler — lightweight "where am I?" status check.
 */

import {
  getActiveBranch,
  getLogPath,
  getCommitsPath,
  readMainContext,
} from '../../context.js';
import { existsSync, readFileSync } from 'node:fs';

export interface StatusArgs {
  // No required args — zero-arg status check
}

export async function handleStatus(contextRoot: string, _args: StatusArgs): Promise<string> {
  const activeBranch = getActiveBranch(contextRoot);
  const parts: string[] = [];

  parts.push(`## GCC Status`);
  parts.push(`**Active branch**: ${activeBranch}`);

  // Last commit
  const lastCommit = getLastCommit(contextRoot, activeBranch);
  if (lastCommit) {
    parts.push(`**Last commit**: ${lastCommit.id} — ${lastCommit.title} (${lastCommit.timestamp})`);
    parts.push(`**Time since last commit**: ${timeAgo(lastCommit.timestamp)}`);
  } else {
    parts.push(`**Last commit**: (none)`);
  }

  // Tool operations since last commit
  const toolCount = getToolCountSinceLastCommit(contextRoot, activeBranch);
  parts.push(`**Tool operations since last commit**: ${toolCount}`);

  // Open branches
  const openBranches = getOpenBranches(contextRoot);
  if (openBranches.length > 0) {
    parts.push(`**Open branches**: ${openBranches.join(', ')}`);
  } else {
    parts.push(`**Open branches**: (none)`);
  }

  return parts.join('\n');
}

interface CommitInfo {
  id: string;
  title: string;
  timestamp: string;
}

function getLastCommit(contextRoot: string, branch: string): CommitInfo | null {
  try {
    const commitsPath = getCommitsPath(contextRoot, branch);
    if (!existsSync(commitsPath)) return null;

    const content = readFileSync(commitsPath, 'utf-8');
    const match = content.match(/## \[(C\d+)\] (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| branch:\S+ \| (.+)/);
    if (!match) return null;

    return { id: match[1], timestamp: match[2], title: match[3] };
  } catch {
    return null;
  }
}

function getToolCountSinceLastCommit(contextRoot: string, branch: string): number {
  try {
    const logPath = getLogPath(contextRoot, branch);
    if (!existsSync(logPath)) return 0;

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    // Count backwards from end until we hit a COMMIT line
    let count = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('COMMIT')) break;
      if (lines[i].startsWith('|')) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

function getOpenBranches(contextRoot: string): string[] {
  try {
    const mainContent = readMainContext(contextRoot);
    if (!mainContent) return [];

    const sectionStart = mainContent.indexOf('## Open Branches');
    if (sectionStart === -1) return [];

    const nextSection = mainContent.indexOf('\n## ', sectionStart + 1);
    const sectionEnd = nextSection !== -1 ? nextSection : mainContent.length;
    const section = mainContent.slice(sectionStart, sectionEnd);

    const branches = section.split('\n')
      .filter(l => l.startsWith('- ') && !l.includes('(none)'))
      .map(l => l.slice(2).trim());

    return branches;
  } catch {
    return [];
  }
}

function timeAgo(timestamp: string): string {
  try {
    const commitDate = new Date(timestamp.replace(' ', 'T'));
    const now = new Date();
    const diffMs = now.getTime() - commitDate.getTime();

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return 'unknown';
  }
}

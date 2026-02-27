/**
 * gcc_context handler — progressive context retrieval.
 */

import {
  getActiveBranch,
  readMainContext,
  readRecentCommits,
  getBranchHeader,
  getCommitsPath,
} from '../../context.js';
import { existsSync, readFileSync } from 'node:fs';

export interface ContextArgs {
  level: number;
  branch?: string;
  commit_id?: string;
  metadata_segment?: string;
}

export async function handleContext(contextRoot: string, args: ContextArgs): Promise<string> {
  const { level, commit_id, metadata_segment } = args;

  if (!level || level < 1 || level > 5) {
    return 'Error: level must be between 1 and 5';
  }

  const activeBranch = getActiveBranch(contextRoot);
  const branch = args.branch || activeBranch;
  const parts: string[] = [];

  // Level 1: main.md only
  const mainContent = readMainContext(contextRoot);
  if (mainContent) {
    parts.push(`## GCC Context (Active: ${activeBranch})\n`);
    parts.push(mainContent);
  } else {
    return 'No GCC context found. Run ensureContextStructure or start a session.';
  }

  if (level >= 2 && level < 4) {
    // Level 2-3: + last 3 commits from active branch
    const recentCommits = readRecentCommits(contextRoot, branch, 3);
    if (recentCommits) {
      parts.push(`\n## Recent Commits (${branch})\n${recentCommits}`);
    }
  }

  if (level >= 3) {
    // Level 3: + branch header
    if (branch !== 'main') {
      const header = getBranchHeader(contextRoot, branch);
      if (header) {
        parts.push(`\n## Branch: ${branch}\n${header}`);
      }
    }
  }

  if (level >= 4) {
    // Level 4: + last 10 commits (supersedes level 2's 3 commits)
    const moreCommits = readRecentCommits(contextRoot, branch, 10);
    if (moreCommits) {
      parts.push(`\n## Extended History (${branch}, last 10)\n${moreCommits}`);
    }
  }

  if (level >= 5) {
    // Level 5: specific commit or metadata search
    if (commit_id) {
      const specific = findCommitById(contextRoot, branch, commit_id);
      if (specific) {
        parts.push(`\n## Commit ${commit_id}\n${specific}`);
      } else {
        parts.push(`\n## Commit ${commit_id} not found in branch:${branch}`);
      }
    }

    if (metadata_segment) {
      const matches = searchCommits(contextRoot, branch, metadata_segment);
      if (matches) {
        parts.push(`\n## Search: "${metadata_segment}"\n${matches}`);
      } else {
        parts.push(`\n## No matches for "${metadata_segment}" in branch:${branch}`);
      }
    }
  }

  return parts.join('\n');
}

function findCommitById(contextRoot: string, branch: string, commitId: string): string | null {
  try {
    const commitsPath = getCommitsPath(contextRoot, branch);
    if (!existsSync(commitsPath)) return null;

    const content = readFileSync(commitsPath, 'utf-8');
    const entries = content.split(/(?=## \[C\d+\])/).filter(e => e.startsWith('## [C'));

    const match = entries.find(e => e.includes(`[${commitId}]`));
    return match?.trim() || null;
  } catch {
    return null;
  }
}

function searchCommits(contextRoot: string, branch: string, term: string): string | null {
  try {
    const commitsPath = getCommitsPath(contextRoot, branch);
    if (!existsSync(commitsPath)) return null;

    const content = readFileSync(commitsPath, 'utf-8');
    const entries = content.split(/(?=## \[C\d+\])/).filter(e => e.startsWith('## [C'));

    const lowerTerm = term.toLowerCase();
    const matches = entries.filter(e => e.toLowerCase().includes(lowerTerm));

    if (matches.length === 0) return null;
    return matches.slice(0, 5).join('\n').trim();
  } catch {
    return null;
  }
}

/**
 * gcc_context handler — progressive context retrieval.
 */

import { withDbRead, readMainMarkdown } from '../../context.js';
import { getGCCRoot } from './shared.js';
import type { Commit, Branch } from '../../db/index.js';

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

  const gccRoot = getGCCRoot(contextRoot);
  const parts: string[] = [];

  const data = withDbRead(gccRoot, (db) => {
    const active = db.getActiveBranch();
    const targetBranchName = args.branch ?? active.name;
    const targetBranch = db.getBranchByName(targetBranchName);
    return {
      activeName: active.name,
      targetName: targetBranchName,
      targetBranch,
      recent3: db.listRecentCommits(targetBranchName, 3),
      recent10: db.listRecentCommits(targetBranchName, 10),
      specificCommit: commit_id ? db.getCommitById(commit_id) : null,
      searchResults: metadata_segment ? db.searchCommits(metadata_segment, 5) : [],
    };
  });

  const mainContent = readMainMarkdown(gccRoot);
  if (mainContent) {
    parts.push(`## GCC Context (Active: ${data.activeName})\n`);
    parts.push(mainContent);
  } else {
    return 'No GCC context found. Start a session.';
  }

  if (level >= 2 && level < 4 && data.recent3.length > 0) {
    parts.push(`\n## Recent Commits (${data.targetName})\n${renderCommits(data.recent3)}`);
  }

  if (level >= 3 && data.targetName !== 'main' && data.targetBranch) {
    parts.push(`\n## Branch: ${data.targetName}\n${renderBranchHeader(data.targetBranch)}`);
  }

  if (level >= 4 && data.recent10.length > 0) {
    parts.push(`\n## Extended History (${data.targetName}, last 10)\n${renderCommits(data.recent10)}`);
  }

  if (level >= 5) {
    if (commit_id) {
      if (data.specificCommit) {
        parts.push(`\n## Commit ${commit_id}\n${renderCommits([data.specificCommit])}`);
      } else {
        parts.push(`\n## Commit ${commit_id} not found`);
      }
    }
    if (metadata_segment) {
      if (data.searchResults.length > 0) {
        parts.push(`\n## Search: "${metadata_segment}"\n${renderCommits(data.searchResults)}`);
      } else {
        parts.push(`\n## No matches for "${metadata_segment}"`);
      }
    }
  }

  return parts.join('\n');
}

function renderCommits(commits: Commit[]): string {
  return commits.map(c => {
    const files = c.files.length > 0 ? c.files.join(', ') : '(none)';
    const tags = c.tags.length > 0 ? `\n**Tags**: ${c.tags.join(', ')}` : '';
    const ts = c.ts.slice(0, 16).replace('T', ' ');
    return `## [${c.commit_id}] ${ts} | branch:${c.branch_name} | ${c.title}
**What**: ${c.what}
**Why**: ${c.why}
**Files**: ${files}
**Next**: ${c.next_step}${tags}`;
  }).join('\n\n---\n\n');
}

function renderBranchHeader(branch: Branch): string {
  const lines: string[] = [];
  if (branch.purpose) lines.push(`**Purpose**: ${branch.purpose}`);
  if (branch.hypothesis) lines.push(`**Hypothesis**: ${branch.hypothesis}`);
  if (branch.conclusion) {
    lines.push(`**Conclusion** (${branch.outcome ?? 'pending'}): ${branch.conclusion}`);
  }
  return lines.join('\n');
}

/**
 * gcc_search handler — full-text search across commits.
 */

import { withDbRead } from '../../context.js';
import { getGCCRoot } from './shared.js';
import type { Commit } from '../../db/index.js';

export interface SearchArgs {
  query: string;
  limit?: number;
  tag?: string;
  branch?: string;
}

export async function handleSearch(contextRoot: string, args: SearchArgs): Promise<string> {
  const { query, limit = 10, tag, branch } = args;

  if (!query || !query.trim()) {
    return 'Error: query is required';
  }

  const gccRoot = getGCCRoot(contextRoot);
  const results = withDbRead(gccRoot, (db) => {
    let commits = tag
      ? db.listCommitsByTag(tag, Math.max(limit * 2, 50))
      : db.searchCommits(query, limit);

    if (tag) {
      // With tag filter, intersect with FTS results
      const lower = query.toLowerCase();
      commits = commits.filter(c =>
        c.title.toLowerCase().includes(lower) ||
        c.what.toLowerCase().includes(lower) ||
        c.why.toLowerCase().includes(lower) ||
        c.next_step.toLowerCase().includes(lower)
      );
    }

    if (branch) {
      commits = commits.filter(c => c.branch_name === branch);
    }

    return commits.slice(0, limit);
  });

  if (results.length === 0) {
    const filters = [tag && `tag:${tag}`, branch && `branch:${branch}`].filter(Boolean).join(', ');
    return `No commits match "${query}"${filters ? ` (${filters})` : ''}`;
  }

  const header = `## Search results for "${query}"${tag ? ` [tag:${tag}]` : ''}${branch ? ` [branch:${branch}]` : ''}\n\n`;
  return header + results.map(formatCommit).join('\n\n---\n\n');
}

function formatCommit(c: Commit): string {
  const files = c.files.length > 0 ? c.files.join(', ') : '(none)';
  const tags = c.tags.length > 0 ? `\n**Tags**: ${c.tags.join(', ')}` : '';
  const ts = c.ts.slice(0, 16).replace('T', ' ');
  return `## [${c.commit_id}] ${ts} | branch:${c.branch_name} | ${c.title}
**What**: ${c.what}
**Why**: ${c.why}
**Files**: ${files}
**Next**: ${c.next_step}${tags}`;
}

/**
 * PostCompact hook — re-inject GCC context after compaction.
 */

import { readStdin, isGCCEnabled, getGCCRoot, output, logError } from '../util.js';
import { withDb, readMainMarkdown, logHookEvent } from '../context.js';
import { loadConfig } from '../config.js';

const TOOL_MENU = `You have 6 MCP tools for context management:
- gcc_commit: Record milestones after completing subtasks, fixing bugs, or reaching checkpoints (supports tags[])
- gcc_branch: Create exploration branches before uncertain/speculative work (supports template: investigation|feature|incident|refactor)
- gcc_merge: Consolidate branch findings when exploration is complete (supports confidence + evidence_files[])
- gcc_context: Recall project state at session start or when context is unclear (levels 1-5)
- gcc_status: Quick status check — active branch, last commit, tool count, recent errors
- gcc_search: Full-text search across all commits (SQLite FTS5 — AND/OR/NOT/"phrase"/prefix*)
Use gcc_commit PROACTIVELY after significant work. Call gcc_context or gcc_search to recall prior work.`;

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);

    const gccRoot = getGCCRoot(input.cwd);
    const cfg = loadConfig(gccRoot);

    let activeBranch = 'main';
    let recentCommits: any[] = [];

    try {
      const r = await withDb(gccRoot, async (db) => ({
        activeBranch: db.getActiveBranch().name,
        recentCommits: db.listRecentCommitsGlobal(cfg.recentCommitCount),
      }));
      activeBranch = r.activeBranch;
      recentCommits = r.recentCommits;
    } catch (e) {
      process.stderr.write(`[gcc] post-compact: DB access failed: ${e instanceof Error ? e.message : e}\n`);
    }

    try { logHookEvent(gccRoot, { event: 'compact-post', summary: input.trigger ?? 'unknown' }); } catch { /* */ }

    const mainContent = readMainMarkdown(gccRoot);

    let contextText = `## GCC Context (Active: ${activeBranch})\n${TOOL_MENU}\n\n`;

    if (mainContent) {
      contextText += mainContent;
      if (recentCommits.length > 0) {
        contextText += `\n## Recent Commit Details\n`;
        contextText += recentCommits.map(c => {
          const files = c.files.length > 0 ? c.files.join(', ') : '(none)';
          const ts = c.ts.slice(0, 16).replace('T', ' ');
          return `## [${c.commit_id}] ${ts} | branch:${c.branch_name} | ${c.title}\n**What**: ${c.what}\n**Why**: ${c.why}\n**Files**: ${files}\n**Next**: ${c.next_step}`;
        }).join('\n\n---\n\n');
      }
    } else {
      contextText += `(GCC initialized but no rendered project state available — context may have been recently cleared.)`;
    }

    output({
      hookSpecificOutput: {
        hookEventName: 'PostCompact',
        additionalContext: contextText,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
    output({
      hookSpecificOutput: {
        hookEventName: 'PostCompact',
        additionalContext: `## GCC Context (fallback)\n${TOOL_MENU}`,
      },
    });
  }
}

main();

/**
 * SessionStart hook — inject GCC context and MCP tool references.
 *
 * Runs on every session start (startup/resume/clear/compact). Even when
 * context rendering fails or the DB is empty, we always inject at minimum
 * the GCC tool menu so Claude knows the tools exist.
 */

import { readStdin, ensureGCCRoot, getGCCRoot, output, logError } from '../util.js';
import { getContextDir, withDb, readMainMarkdown, logHookEvent, type Commit } from '../context.js';
import { loadConfig } from '../config.js';
import { needsMigration, migrateV1ToV2 } from '../migrate.js';

const TOOL_MENU = `You have 6 MCP tools for context management:
- gcc_commit: Record milestones after completing subtasks, fixing bugs, or reaching checkpoints (supports tags[])
- gcc_branch: Create exploration branches before uncertain/speculative work (supports template: investigation|feature|incident|refactor)
- gcc_merge: Consolidate branch findings when exploration is complete (supports confidence + evidence_files[])
- gcc_context: Recall project state at session start or when context is unclear (levels 1-5)
- gcc_status: Quick status check — active branch, last commit, tool count, recent errors
- gcc_search: Full-text search across all commits (SQLite FTS5 — AND/OR/NOT/"phrase"/prefix*)
Use gcc_commit PROACTIVELY after significant work. Call gcc_context or gcc_search to recall prior work.`;

async function main(): Promise<void> {
  const cwd = await (async () => { try { return (await readStdin()).cwd; } catch { return process.cwd(); } })();

  try {
    ensureGCCRoot(cwd);
    const gccRoot = getGCCRoot(cwd);
    const contextRoot = getContextDir(gccRoot);

    if (needsMigration(contextRoot)) migrateV1ToV2(contextRoot);

    const cfg = loadConfig(gccRoot);

    let activeBranch = 'main';
    let recentCommits: Commit[] = [];

    try {
      const dbResult = await withDb(gccRoot, async (db) => ({
        activeBranch: db.getActiveBranch().name,
        recentCommits: db.listRecentCommitsGlobal(cfg.recentCommitCount),
      }));
      activeBranch = dbResult.activeBranch;
      recentCommits = dbResult.recentCommits;
    } catch (e) {
      // Surface to error.log (visible) instead of stderr-only (invisible to debugging).
      logError(gccRoot, e instanceof Error ? new Error(`session-start DB read: ${e.message}`) : e);
    }

    const mainContent = readMainMarkdown(gccRoot);

    let contextText = `## GCC Context (Active: ${activeBranch})\n${TOOL_MENU}\n\n`;

    if (mainContent) {
      contextText += mainContent;
      if (recentCommits.length > 0) {
        contextText += `\n## Recent Commit Details\n`;
        contextText += recentCommits.map((c) => {
          const files = c.files.length > 0 ? c.files.join(', ') : '(none)';
          const ts = c.ts.slice(0, 16).replace('T', ' ');
          return `## [${c.commit_id}] ${ts} | branch:${c.branch_name} | ${c.title}\n**What**: ${c.what}\n**Why**: ${c.why}\n**Files**: ${files}\n**Next**: ${c.next_step}`;
        }).join('\n\n---\n\n');
      }
    } else {
      contextText += `(GCC initialized. No project context yet — call gcc_commit after your first meaningful unit of work.)`;
    }

    try { logHookEvent(gccRoot, { event: 'session-start', summary: 'startup' }); } catch { /* */ }

    output({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: contextText,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(cwd), e); } catch { /* */ }
    // Minimal fallback: at least tell Claude the tools exist.
    output({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `## GCC Context (fallback)\n${TOOL_MENU}`,
      },
    });
  }
}

main();

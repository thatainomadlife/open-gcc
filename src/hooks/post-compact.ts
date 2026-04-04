/**
 * PostCompact hook — re-inject GCC context after context compaction.
 *
 * After compaction, the context injected by SessionStart is lost.
 * This hook re-injects the project state so the agent doesn't lose orientation.
 * Lighter than SessionStart — no migration check, no structure creation.
 */

import { readStdin, getContextRoot, isGCCEnabled, getGCCRoot, output, logError } from '../util.js';
import { loadConfig } from '../config.js';
import { readMainContext, readRecentCommits, getActiveBranch } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    const mainContext = readMainContext(contextRoot);
    if (!mainContext) process.exit(0);

    const gccRoot = getGCCRoot(cwd);
    const cfg = loadConfig(gccRoot);
    const branch = getActiveBranch(contextRoot);
    const recentCommits = readRecentCommits(contextRoot, branch, cfg.recentCommitCount);

    let contextText = `## GCC Context (Active: ${branch})\n`;
    contextText += `You have 5 MCP tools for context management:\n`;
    contextText += `- gcc_commit: Record milestones after completing subtasks, fixing bugs, or reaching checkpoints\n`;
    contextText += `- gcc_branch: Create exploration branches before uncertain/speculative work\n`;
    contextText += `- gcc_merge: Consolidate branch findings when exploration is complete\n`;
    contextText += `- gcc_context: Recall project state at session start or when context is unclear\n`;
    contextText += `- gcc_status: Quick status check — active branch, last commit, tool count\n`;
    contextText += `Use gcc_commit PROACTIVELY after significant work. Call gcc_context if you need to recall prior work.\n\n`;
    contextText += mainContext;

    if (recentCommits) {
      contextText += `\n## Recent Commit Details\n${recentCommits}`;
    }

    output({
      hookSpecificOutput: {
        hookEventName: 'PostCompact',
        additionalContext: contextText,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
    process.exit(0);
  }
}

main();

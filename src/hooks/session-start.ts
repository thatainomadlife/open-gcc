/**
 * SessionStart hook — inject GCC context into Claude's system prompt.
 *
 * Reads main.md and recent commits, returns them as additionalContext
 * so Claude is aware of project state at session start.
 */

import { readStdin, getContextRoot, ensureGCCRoot, getGCCRoot, output, logError } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { loadConfig } from '../config.js';
import { readMainContext, readRecentCommits, getActiveBranch } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    // Auto-create .gcc/ in every project, add to .gitignore
    ensureGCCRoot(cwd);

    const contextRoot = getContextRoot(cwd);
    ensureContextStructure(contextRoot);

    const mainContext = readMainContext(contextRoot);
    if (!mainContext) process.exit(0);

    const gccRoot = getGCCRoot(cwd);
    const cfg = loadConfig(gccRoot);
    const branch = getActiveBranch(contextRoot);
    const recentCommits = readRecentCommits(contextRoot, cfg.recentCommitCount);

    let contextText = `## GCC Context (Active: ${branch})\n`;
    contextText += `Record milestones with /gcc-commit. Use /gcc-branch and /gcc-merge for explorations.\n\n`;
    contextText += mainContext;

    if (recentCommits) {
      contextText += `\n## Recent Commit Details\n${recentCommits}`;
    }

    output({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: contextText,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
    process.exit(0);
  }
}

main();

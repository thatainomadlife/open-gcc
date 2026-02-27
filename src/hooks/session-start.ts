/**
 * SessionStart hook — inject GCC context and MCP tool references.
 *
 * v2: No LLM calls. Runs migration if needed.
 * Returns context as additionalContext pointing Claude at MCP tools.
 */

import { readStdin, getContextRoot, ensureGCCRoot, getGCCRoot, output, logError } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { loadConfig } from '../config.js';
import { readMainContext, readRecentCommits, getActiveBranch } from '../context.js';
import { needsMigration, migrateV1ToV2 } from '../migrate.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    // Auto-create .gcc/ in every project, add to .gitignore
    ensureGCCRoot(cwd);

    const contextRoot = getContextRoot(cwd);

    // Run v1→v2 migration if needed
    if (needsMigration(contextRoot)) {
      migrateV1ToV2(contextRoot);
    }

    ensureContextStructure(contextRoot);

    const mainContext = readMainContext(contextRoot);
    if (!mainContext) process.exit(0);

    const gccRoot = getGCCRoot(cwd);
    const cfg = loadConfig(gccRoot);
    const branch = getActiveBranch(contextRoot);
    const recentCommits = readRecentCommits(contextRoot, branch, cfg.recentCommitCount);

    let contextText = `## GCC Context (Active: ${branch})\n`;
    contextText += `You have 4 MCP tools for context management:\n`;
    contextText += `- gcc_commit: Record milestones after completing subtasks, fixing bugs, or reaching checkpoints\n`;
    contextText += `- gcc_branch: Create exploration branches before uncertain/speculative work\n`;
    contextText += `- gcc_merge: Consolidate branch findings when exploration is complete\n`;
    contextText += `- gcc_context: Recall project state at session start or when context is unclear\n`;
    contextText += `Use gcc_commit PROACTIVELY after significant work. Call gcc_context if you need to recall prior work.\n\n`;
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

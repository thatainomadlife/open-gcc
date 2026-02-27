/**
 * UserPromptSubmit hook — lightweight MCP tool reminder.
 *
 * Injects a short line keeping tool names fresh in context,
 * especially useful after long sessions or compaction.
 */

import { readStdin, getContextRoot, isGCCEnabled, output } from '../util.js';
import { getActiveBranch } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    const branch = getActiveBranch(contextRoot);

    output({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `[GCC active: branch=${branch}. Tools: gcc_commit, gcc_branch, gcc_merge, gcc_context]`,
      },
    });
  } catch {
    process.exit(0);
  }
}

main();

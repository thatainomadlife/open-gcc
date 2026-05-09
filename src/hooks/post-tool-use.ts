/**
 * PostToolUse hook — log tool use on active branch, nudge for commit every N ops.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError, output } from '../util.js';
import { withDbRead, logHookEvent } from '../context.js';
import { loadConfig } from '../config.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;
    if (!isGCCEnabled(cwd)) process.exit(0);

    const gccRoot = getGCCRoot(cwd);
    const toolName = input.tool_name || 'unknown';
    const toolInput = input.tool_input ?? {};
    const filePath = (typeof toolInput.file_path === 'string' ? toolInput.file_path : '')
      || (typeof toolInput.command === 'string' ? toolInput.command.slice(0, 80) : '')
      || '';

    logHookEvent(gccRoot, {
      event: 'tool-use',
      toolName: toolName.toLowerCase(),
      summary: filePath,
    });

    const cfg = loadConfig(gccRoot);
    const count = withDbRead(gccRoot, (db) => db.countLogsSinceLastCommit(db.getActiveBranch().name));
    if (count > 0 && count % cfg.nudgeAfterToolUses === 0) {
      output({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `You've made ${count} tool operations since your last gcc_commit. Consider recording a milestone.`,
        },
      });
    }
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

/**
 * UserPromptSubmit hook — tool reminder + log.
 */

import { readStdin, isGCCEnabled, getGCCRoot, output, logError } from '../util.js';
import { logHookEvent, withDbRead } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);

    const gccRoot = getGCCRoot(input.cwd);
    const active = withDbRead(gccRoot, (db) => db.getActiveBranch().name);

    logHookEvent(gccRoot, {
      event: 'user-prompt-submit',
      summary: (input.user_prompt ?? '').slice(0, 100),
    });

    output({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `[GCC active: branch=${active}. Tools: gcc_commit, gcc_branch, gcc_merge, gcc_context, gcc_status]`,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

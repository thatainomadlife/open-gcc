/**
 * PreCompact hook — nudge agent to commit before compaction.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError, output } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'compact-pre',
      summary: input.trigger ?? 'unknown',
    });
    output({
      hookSpecificOutput: {
        hookEventName: 'PreCompact',
        additionalContext: 'Context compaction imminent. Call gcc_commit now if you have unrecorded work.',
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

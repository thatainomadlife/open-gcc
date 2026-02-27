/**
 * PreCompact hook — nudge agent to commit before context compaction.
 *
 * v2: No LLM call. Just injects a reminder for the agent to use gcc_commit.
 */

import { readStdin, isGCCEnabled, output } from '../util.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    output({
      hookSpecificOutput: {
        hookEventName: 'PreCompact',
        additionalContext: 'Context compaction imminent. Call gcc_commit now if you have unrecorded work.',
      },
    });
  } catch {
    process.exit(0);
  }
}

main();

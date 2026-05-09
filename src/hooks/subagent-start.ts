/**
 * SubagentStart hook — log subagent spawn.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'subagent-start',
      toolName: input.agent_type ?? input.agent_name ?? 'unknown',
      summary: (input.agent_description ?? '').slice(0, 120),
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

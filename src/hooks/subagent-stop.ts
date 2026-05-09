/**
 * SubagentStop hook — log subagent completion.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'subagent-stop',
      toolName: input.agent_type ?? input.agent_name ?? 'unknown',
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

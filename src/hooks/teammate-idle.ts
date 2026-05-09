/**
 * TeammateIdle hook — log agent team teammate idle events.
 *
 * Useful for detecting load imbalance or stalled subagents in agent
 * team workflows.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const agentType = input.agent_type ?? 'unknown';
    const reason = input.idle_reason ?? 'unknown';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'teammate-idle',
      summary: `${agentType}: ${reason}`.slice(0, 200),
      payload: {
        agent_id: input.agent_id,
        agent_type: agentType,
        idle_reason: reason,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

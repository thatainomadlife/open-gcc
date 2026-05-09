/**
 * StopFailure hook — log API error that ended a turn.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'stop-failure',
      summary: input.source ?? 'unknown',
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

/**
 * CwdChanged hook — log working directory changes mid-session.
 *
 * Catches multi-project sessions and `/add-dir` operations.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const oldCwd = input.old_cwd ?? '?';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'cwd-changed',
      summary: `${oldCwd} -> ${input.cwd}`.slice(0, 200),
      payload: { cwd: input.cwd, old_cwd: oldCwd },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

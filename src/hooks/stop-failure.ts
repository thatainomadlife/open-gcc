/**
 * StopFailure hook — log session failures for post-mortem.
 *
 * When a session dies from rate limits, auth errors, server errors, etc.,
 * this logs the failure reason to the active branch's log.md.
 * Fire-and-forget — never blocks.
 */

import { readStdin, getContextRoot, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { getActiveBranch, appendLog } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    const branch = getActiveBranch(contextRoot);
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // source contains the failure type: rate_limit, authentication_failed, etc.
    const reason = input.source || 'unknown';
    await appendLog(contextRoot, branch, `| ${timestamp} | session-failure | ${reason} | ERROR |`);
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

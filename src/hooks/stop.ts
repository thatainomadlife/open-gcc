/**
 * Stop hook — lightweight session-end logging.
 *
 * v2: No LLM call, no context injection.
 * Stop hooks can't inject additionalContext (session is ending).
 * Just logs to the active branch's log.md for audit trail.
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

    await appendLog(contextRoot, branch, `| ${timestamp} | session-end | stop hook | - |`);
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

/**
 * PermissionDenied hook — log auto-mode denials.
 *
 * Distinguishes policy-blocking from missing-permission. Feeds into
 * allowlist tuning and security posture audit.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const toolName = input.tool_name ?? 'unknown';
    const reason = input.auto_deny_reason ?? 'unknown';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'permission-denied',
      toolName,
      summary: `denied: ${toolName} (${reason})`.slice(0, 200),
      payload: {
        tool_name: toolName,
        permission_mode: input.permission_mode,
        auto_deny_reason: reason,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

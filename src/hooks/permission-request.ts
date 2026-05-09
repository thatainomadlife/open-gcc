/**
 * PermissionRequest hook — log permission dialog events.
 *
 * Useful for /fewer-permission-prompts skill profiling and security
 * posture auditing.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const toolName = input.tool_name ?? 'unknown';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'permission-request',
      toolName,
      summary: `request: ${toolName}`.slice(0, 200),
      payload: {
        tool_name: toolName,
        suggestion_count: Array.isArray(input.permission_suggestions) ? input.permission_suggestions.length : 0,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

/**
 * PreToolUse hook — log INTENT before tool execution.
 *
 * Distinct from PostToolUse (which logs outcome). Captures what Claude
 * wanted to do, not just what succeeded — useful for diagnosing chains
 * where one tool failed and broke the rest.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const toolName = input.tool_name ?? 'unknown';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'tool-use-pre',
      toolName,
      summary: toolName,
      payload: {
        tool_name: toolName,
        tool_use_id: input.tool_use_id,
        permission_mode: input.permission_mode,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

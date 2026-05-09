/**
 * PostToolUseFailure hook — log failed tool operations.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const toolInput = input.tool_input ?? {};
    const filePath = (typeof toolInput.file_path === 'string' ? toolInput.file_path : '')
      || (typeof toolInput.command === 'string' ? toolInput.command.slice(0, 80) : '')
      || '';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'tool-failure',
      toolName: (input.tool_name ?? 'unknown').toLowerCase(),
      summary: filePath,
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

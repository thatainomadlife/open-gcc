/**
 * PostToolBatch hook — log batched parallel tool resolution.
 *
 * Records batch_id + counts of successful vs failed tool calls.
 * Useful for atomic-operation auditing (e.g., multi-file write + test).
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const calls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
    const responses = Array.isArray(input.tool_responses) ? input.tool_responses : [];
    const failures = responses.filter((r) => {
      if (r && typeof r === 'object' && 'status' in r) {
        return (r as { status?: string }).status === 'failed';
      }
      return false;
    }).length;
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'tool-use-batch',
      summary: `batch ${input.batch_id ?? '?'}: ${calls.length} calls, ${failures} failures`.slice(0, 200),
      payload: {
        batch_id: input.batch_id,
        call_count: calls.length,
        failure_count: failures,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

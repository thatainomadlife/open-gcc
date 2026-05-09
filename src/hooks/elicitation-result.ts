/**
 * ElicitationResult hook — log MCP form responses.
 *
 * OPSEC: user_response NOT logged (may contain credentials, secrets,
 * or other sensitive form input). Records server_name + tool_name +
 * field count only.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const serverName = input.server_name ?? 'unknown';
    const toolName = input.tool_name ?? 'unknown';
    const fieldCount =
      input.user_response && typeof input.user_response === 'object'
        ? Object.keys(input.user_response).length
        : 0;
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'elicitation-result',
      toolName,
      summary: `${serverName}/${toolName} (${fieldCount} fields filled)`.slice(0, 200),
      payload: { server_name: serverName, tool_name: toolName, field_count: fieldCount },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

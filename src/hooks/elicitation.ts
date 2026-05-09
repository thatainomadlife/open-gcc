/**
 * Elicitation hook — log MCP server form requests.
 *
 * Records server_name + tool_name. form_schema NOT logged in full
 * (could contain sensitive field hints) — schema field count only.
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
      input.form_schema && typeof input.form_schema === 'object' && 'properties' in input.form_schema
        ? Object.keys((input.form_schema as { properties?: Record<string, unknown> }).properties ?? {}).length
        : 0;
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'elicitation',
      toolName,
      summary: `${serverName}/${toolName} (${fieldCount} fields)`.slice(0, 200),
      payload: { server_name: serverName, tool_name: toolName, field_count: fieldCount },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

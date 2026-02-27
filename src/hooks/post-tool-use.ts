/**
 * PostToolUse hook — lightweight OTA log.
 *
 * v2: No edit-flag system. Just appends tool usage to the active branch's log.md.
 * Fires on Edit/Write/NotebookEdit/Bash tool completions.
 */

import { readStdin, getContextRoot, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { getActiveBranch, appendLog } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    ensureContextStructure(contextRoot);

    const toolName = input.tool_name || 'unknown';
    const filePath = (input.tool_input?.file_path as string)
      || (input.tool_input?.command as string)?.slice(0, 80)
      || '';
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const branch = getActiveBranch(contextRoot);
    const logLine = `| ${timestamp} | ${toolName.toLowerCase()} | ${filePath} | OK |`;
    await appendLog(contextRoot, branch, logLine);
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

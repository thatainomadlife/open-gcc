/**
 * PostToolUse hook — set edit flag and OTA log.
 *
 * Fires on Edit/Write/NotebookEdit tool completions.
 * A. Writes .edit-flag to signal that edits happened this turn.
 * B. Appends one line to log.md for OTA tracking.
 */

import { readStdin, getContextRoot, getGCCRoot, isGCCEnabled, logError } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { writeEditFlag, appendLog } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    ensureContextStructure(contextRoot);

    const toolName = input.tool_name || 'unknown';
    const filePath = (input.tool_input?.file_path as string) || '';
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // A. Write edit flag
    await writeEditFlag(contextRoot, {
      tool: toolName,
      file: filePath,
      timestamp,
    });

    // B. OTA log
    const status = 'OK';
    const logLine = `| ${timestamp.slice(0, 16)} | ${toolName.toLowerCase()} | ${filePath} | ${status} |`;
    await appendLog(contextRoot, logLine);
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

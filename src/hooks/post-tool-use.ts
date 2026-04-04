/**
 * PostToolUse hook — lightweight OTA log.
 *
 * v2: No edit-flag system. Just appends tool usage to the active branch's log.md.
 * Fires on Edit/Write/NotebookEdit/Bash tool completions.
 */

import { readStdin, getContextRoot, isGCCEnabled, getGCCRoot, logError, output } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { getActiveBranch, appendLog, getLogPath } from '../context.js';
import { loadConfig } from '../config.js';
import { existsSync, readFileSync } from 'node:fs';

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

    // Auto-commit nudge: count tool uses since last commit
    const gccRoot = getGCCRoot(cwd);
    const cfg = loadConfig(gccRoot);
    const count = countSinceLastCommit(contextRoot, branch);
    if (count > 0 && count % cfg.nudgeAfterToolUses === 0) {
      output({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `You've made ${count} tool operations since your last gcc_commit. Consider recording a milestone.`,
        },
      });
    }
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

function countSinceLastCommit(contextRoot: string, branch: string): number {
  try {
    const logPath = getLogPath(contextRoot, branch);
    if (!existsSync(logPath)) return 0;

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    let count = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('COMMIT')) break;
      if (lines[i].startsWith('|')) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

main();

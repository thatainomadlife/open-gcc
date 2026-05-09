/**
 * InstructionsLoaded hook — log when CLAUDE.md or .claude/rules/*.md files load.
 *
 * Tracks instruction drift across sessions. Records file_path + memory_type
 * (User|Project|Local|Managed) + load_reason (session_start|nested_traversal|
 * path_glob_match|include|compact) per session.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const filePath = input.file_path ?? 'unknown';
    const memoryType = input.memory_type ?? 'unknown';
    const loadReason = input.load_reason ?? 'unknown';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'instructions-loaded',
      summary: `${memoryType} ${loadReason}: ${filePath}`.slice(0, 200),
      payload: {
        file_path: filePath,
        memory_type: memoryType,
        load_reason: loadReason,
        globs: input.globs,
        trigger_file_path: input.trigger_file_path,
        parent_file_path: input.parent_file_path,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

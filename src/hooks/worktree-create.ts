/**
 * WorktreeCreate hook — log new git worktree creation.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

interface WorktreeInput {
  worktree_path?: string;
  branch?: string;
}

async function main(): Promise<void> {
  try {
    const input = await readStdin() as WorktreeInput & { cwd: string };
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const path = input.worktree_path ?? '';
    const branch = input.branch ?? '';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'worktree-create',
      summary: `${branch} @ ${path}`.slice(0, 200),
      payload: { worktree_path: path, branch },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

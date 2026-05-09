/**
 * TaskCompleted hook — log task completion.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

interface TaskInput {
  task_id?: string;
  subject?: string;
  status?: string;
}

async function main(): Promise<void> {
  try {
    const input = await readStdin() as TaskInput & { cwd: string };
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const taskId = input.task_id ?? 'unknown';
    const subject = input.subject ?? '';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'task-completed',
      summary: `${taskId}: ${subject}`.slice(0, 200),
      payload: { task_id: taskId, subject, status: input.status ?? 'completed' },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

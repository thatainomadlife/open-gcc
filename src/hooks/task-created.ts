/**
 * TaskCreated hook — log task creation.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

interface TaskInput {
  task_id?: string;
  subject?: string;
  description?: string;
}

async function main(): Promise<void> {
  try {
    const input = await readStdin() as TaskInput & { cwd: string };
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const taskId = input.task_id ?? 'unknown';
    const subject = input.subject ?? '';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'task-created',
      summary: `${taskId}: ${subject}`.slice(0, 200),
      payload: { task_id: taskId, subject, description: input.description },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

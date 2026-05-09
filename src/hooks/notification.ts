/**
 * Notification hook — log Claude Code notification events.
 *
 * Tracks notification_type (permission_prompt|idle_prompt|auth_success|
 * elicitation_dialog) for UX/permission-prompt-fatigue detection.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const notifType = input.notification_type ?? 'unknown';
    const message = typeof input.message === 'string' ? input.message.slice(0, 100) : '';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'notification',
      summary: `${notifType}: ${message}`.slice(0, 200),
      payload: { notification_type: notifType, message },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

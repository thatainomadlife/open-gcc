/**
 * ConfigChange hook — log settings.json drift mid-session.
 *
 * Catches the linter-reverts-my-edits class of bug, plus any external
 * tool that mutates settings while Claude is running.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const configType = input.config_type ?? 'unknown';
    const fields = input.changed_fields ?? [];
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'config-change',
      summary: `${configType}: ${fields.join(',')}`.slice(0, 200),
      payload: { config_type: configType, changed_fields: fields },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

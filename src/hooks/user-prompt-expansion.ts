/**
 * UserPromptExpansion hook — log slash command and skill invocations.
 *
 * Profiling: track which slash commands and skills Zac actually uses.
 * Records expansion_type (slash_command|mcp_prompt) + command_name.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const expansionType = input.expansion_type ?? 'unknown';
    const commandName = input.command_name ?? 'unknown';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'user-prompt-expansion',
      summary: `${expansionType}: ${commandName}`.slice(0, 200),
      payload: {
        expansion_type: expansionType,
        command_name: commandName,
        command_args: typeof input.command_args === 'string' ? input.command_args.slice(0, 200) : undefined,
      },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

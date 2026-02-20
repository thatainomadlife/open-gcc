/**
 * PreCompact hook — safety net extraction before context compaction.
 *
 * Always runs extraction regardless of edit flag (context is about to be lost).
 * Cooldown still prevents doubles if stop.ts already committed recently.
 */

import { readStdin, getContextRoot, getGCCRoot, isGCCEnabled, logError } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { clearEditFlag } from '../context.js';
import { extractAndCommit } from '../extractor.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    ensureContextStructure(contextRoot);

    // Clear edit flag if present (we're handling it now)
    await clearEditFlag(contextRoot);

    // Always attempt extraction — context is about to be lost
    const transcriptPath = input.transcript_path;
    if (!transcriptPath) process.exit(0);

    await extractAndCommit(contextRoot, transcriptPath);
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

/**
 * Stop hook — auto-commit on turn completion.
 *
 * Checks if any edits happened this turn (via .edit-flag).
 * If yes, runs the extractor to create a milestone commit.
 * If no, exits silently.
 */

import { readStdin, getContextRoot, getGCCRoot, isGCCEnabled, logError } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { hasEditFlag, clearEditFlag } from '../context.js';
import { extractAndCommit } from '../extractor.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const cwd = input.cwd;

    if (!isGCCEnabled(cwd)) process.exit(0);

    const contextRoot = getContextRoot(cwd);
    ensureContextStructure(contextRoot);

    // Only extract if edits happened this turn
    if (!hasEditFlag(contextRoot)) process.exit(0);

    // Clear flag before extraction (prevents doubles if PreCompact also fires)
    await clearEditFlag(contextRoot);

    // Run extraction
    const transcriptPath = input.transcript_path;
    if (!transcriptPath) process.exit(0);

    await extractAndCommit(contextRoot, transcriptPath);
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

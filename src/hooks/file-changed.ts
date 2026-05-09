/**
 * FileChanged hook — log watched file changes.
 *
 * Default matcher (in install.sh) covers dependency manifests:
 * flake.nix, package.json, pyproject.toml, Cargo.toml, etc. Override
 * via CLAUDE_ENV_FILE env var or per-project settings.json matcher.
 */

import { readStdin, isGCCEnabled, getGCCRoot, logError } from '../util.js';
import { logHookEvent } from '../context.js';

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    if (!isGCCEnabled(input.cwd)) process.exit(0);
    const filePath = input.file_path ?? 'unknown';
    const changeType = input.change_type ?? 'modified';
    logHookEvent(getGCCRoot(input.cwd), {
      event: 'file-changed',
      summary: `${changeType}: ${filePath}`.slice(0, 200),
      payload: { file_path: filePath, change_type: changeType },
    });
  } catch (e) {
    try { logError(getGCCRoot(process.cwd()), e); } catch { /* */ }
  }
}

main();

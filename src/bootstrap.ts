/**
 * GCC bootstrap (v3).
 *
 * v3 stores state in SQLite at .gcc/state.db. Markdown files under
 * .gcc/context/ are rendered views. This module is a no-op shim retained
 * for any external callers; real initialization happens lazily on first
 * `withDb(gccRoot, ...)` call in src/context.ts.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function ensureContextStructure(contextRoot: string): boolean {
  try {
    mkdirSync(join(contextRoot, 'branches'), { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function ensureBranchDir(contextRoot: string, branch: string): boolean {
  try {
    mkdirSync(join(contextRoot, 'branches', branch), { recursive: true });
    return existsSync(join(contextRoot, 'branches', branch));
  } catch {
    return false;
  }
}

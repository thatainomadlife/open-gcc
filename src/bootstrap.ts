/**
 * Auto-bootstrap GCC context directory structure.
 *
 * Called by isGCCEnabled() check — if .gcc/ exists but context/ is missing,
 * creates the full directory structure with templates.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAIN_MD_TEMPLATE = `# Project Context

## Current Focus
(Auto-created by GCC. Update with current goals.)

## Recent Milestones
- (none yet)

## Open Branches
- (none)
`;

const REGISTRY_TEMPLATE = `## Active Branch
main

## Branch History
| Branch | Status | Created |
|--------|--------|---------|
`;

/**
 * Ensure the GCC context directory structure exists.
 * Creates it from templates if missing. Returns true if context is ready.
 */
export function ensureContextStructure(contextRoot: string): boolean {
  try {
    // Ensure directories exist
    mkdirSync(join(contextRoot, 'branches'), { recursive: true });

    // Create each file individually if missing (preserves existing files)
    const files: Array<[string, string]> = [
      [join(contextRoot, 'main.md'), MAIN_MD_TEMPLATE],
      [join(contextRoot, 'commits.md'), '# Milestone Journal\n\n'],
      [join(contextRoot, 'log.md'), ''],
      [join(contextRoot, 'branches', '_registry.md'), REGISTRY_TEMPLATE],
    ];

    for (const [path, template] of files) {
      if (!existsSync(path)) {
        writeFileSync(path, template, 'utf-8');
      }
    }

    return true;
  } catch {
    return false;
  }
}

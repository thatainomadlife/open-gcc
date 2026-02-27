/**
 * Auto-bootstrap GCC context directory structure (v2).
 *
 * v2 layout: commits.md and log.md live per-branch inside branches/{name}/.
 * Branch headers (Purpose/Hypothesis/Conclusion) live at top of branch commits.md.
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

const COMMITS_TEMPLATE = '# Milestone Journal\n\n';

/**
 * Ensure the GCC context directory structure exists (v2 layout).
 * Creates branches/main/ with commits.md + log.md.
 * Returns true if context is ready.
 */
export function ensureContextStructure(contextRoot: string): boolean {
  try {
    // Ensure directories exist
    mkdirSync(join(contextRoot, 'branches', 'main'), { recursive: true });

    // Create each file individually if missing (preserves existing files)
    const files: Array<[string, string]> = [
      [join(contextRoot, 'main.md'), MAIN_MD_TEMPLATE],
      [join(contextRoot, 'branches', '_registry.md'), REGISTRY_TEMPLATE],
      [join(contextRoot, 'branches', 'main', 'commits.md'), COMMITS_TEMPLATE],
      [join(contextRoot, 'branches', 'main', 'log.md'), ''],
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

/**
 * Ensure a branch directory exists with header template in commits.md.
 */
export function ensureBranchDir(
  contextRoot: string,
  branch: string,
  purpose: string = '(Describe what we\'re exploring and why)',
  hypothesis: string = '(What we expect to find or prove)'
): boolean {
  try {
    const branchDir = join(contextRoot, 'branches', branch);
    mkdirSync(branchDir, { recursive: true });

    const commitsPath = join(branchDir, 'commits.md');
    if (!existsSync(commitsPath)) {
      const header = `# Branch: ${branch}

## Purpose
${purpose}

## Hypothesis
${hypothesis}

## Conclusion
(Fill in at merge time — success/failure/partial)

---

# Milestone Journal

`;
      writeFileSync(commitsPath, header, 'utf-8');
    }

    const logPath = join(branchDir, 'log.md');
    if (!existsSync(logPath)) {
      writeFileSync(logPath, '', 'utf-8');
    }

    return true;
  } catch {
    return false;
  }
}

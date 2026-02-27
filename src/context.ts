/**
 * Context file read/write helpers for GCC v2.
 *
 * All commit/log operations are per-branch:
 *   .gcc/context/branches/{branch}/commits.md
 *   .gcc/context/branches/{branch}/log.md
 */

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function getBranchDir(contextRoot: string, branch: string): string {
  return join(contextRoot, 'branches', branch);
}

export function getCommitsPath(contextRoot: string, branch: string): string {
  return join(contextRoot, 'branches', branch, 'commits.md');
}

export function getLogPath(contextRoot: string, branch: string): string {
  return join(contextRoot, 'branches', branch, 'log.md');
}

// ---------------------------------------------------------------------------
// Commit ID management
// ---------------------------------------------------------------------------

/**
 * Get the next commit ID by reading the latest from a branch's commits.md.
 */
export function getNextCommitId(contextRoot: string, branch: string): string {
  try {
    const commitsPath = getCommitsPath(contextRoot, branch);
    if (!existsSync(commitsPath)) return 'C001';

    const content = readFileSync(commitsPath, 'utf-8');
    const match = content.match(/## \[C(\d+)\]/);
    if (!match) return 'C001';

    const nextNum = parseInt(match[1], 10) + 1;
    return `C${String(nextNum).padStart(3, '0')}`;
  } catch {
    return 'C001';
  }
}

// ---------------------------------------------------------------------------
// Branch management
// ---------------------------------------------------------------------------

/**
 * Get the active branch name from _registry.md.
 */
export function getActiveBranch(contextRoot: string): string {
  try {
    const registryPath = join(contextRoot, 'branches', '_registry.md');
    if (!existsSync(registryPath)) return 'main';

    const content = readFileSync(registryPath, 'utf-8');
    const match = content.match(/## Active Branch\n(\S+)/);
    return match?.[1] || 'main';
  } catch {
    return 'main';
  }
}

/**
 * Update the active branch in _registry.md.
 */
export async function updateRegistryActiveBranch(
  contextRoot: string,
  newBranch: string
): Promise<void> {
  const registryPath = join(contextRoot, 'branches', '_registry.md');
  if (!existsSync(registryPath)) return;

  let content = await readFile(registryPath, 'utf-8');
  content = content.replace(
    /## Active Branch\n\S+/,
    `## Active Branch\n${newBranch}`
  );
  await writeFile(registryPath, content, 'utf-8');
}

/**
 * Add a new branch entry to the registry history table.
 */
export async function addBranchToRegistry(
  contextRoot: string,
  branchName: string,
  date: string
): Promise<void> {
  const registryPath = join(contextRoot, 'branches', '_registry.md');
  if (!existsSync(registryPath)) return;

  let content = await readFile(registryPath, 'utf-8');
  // Append row to the history table
  content = content.trimEnd() + `\n| ${branchName} | active | ${date} |\n`;
  await writeFile(registryPath, content, 'utf-8');
}

/**
 * Update a branch's status in the registry history table.
 */
export async function updateRegistryBranchStatus(
  contextRoot: string,
  branchName: string,
  status: string
): Promise<void> {
  const registryPath = join(contextRoot, 'branches', '_registry.md');
  if (!existsSync(registryPath)) return;

  let content = await readFile(registryPath, 'utf-8');
  // Match the row for this branch and replace the status column
  const escaped = branchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  content = content.replace(
    new RegExp(`\\| ${escaped} \\| \\S+ \\|`),
    `| ${branchName} | ${status} |`
  );
  await writeFile(registryPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Commit writing
// ---------------------------------------------------------------------------

/**
 * Prepend a commit entry to a branch's commits.md (after the header).
 */
export async function prependCommit(
  contextRoot: string,
  branch: string,
  entry: string
): Promise<void> {
  const commitsPath = getCommitsPath(contextRoot, branch);

  // Ensure branch directory exists
  const branchDir = getBranchDir(contextRoot, branch);
  if (!existsSync(branchDir)) {
    mkdirSync(branchDir, { recursive: true });
  }

  const existing = existsSync(commitsPath)
    ? await readFile(commitsPath, 'utf-8')
    : '# Milestone Journal\n\n';

  // Look for "# Milestone Journal" anchor first (handles branch files with
  // Purpose/Hypothesis headers above), then fall back to first blank line.
  const journalAnchor = '# Milestone Journal\n\n';
  const journalIdx = existing.indexOf(journalAnchor);
  if (journalIdx !== -1) {
    const insertAt = journalIdx + journalAnchor.length;
    await writeFile(commitsPath, existing.slice(0, insertAt) + entry + existing.slice(insertAt), 'utf-8');
  } else {
    const headerEnd = existing.indexOf('\n\n');
    if (headerEnd !== -1) {
      const header = existing.slice(0, headerEnd + 2);
      const body = existing.slice(headerEnd + 2);
      await writeFile(commitsPath, header + entry + body, 'utf-8');
    } else {
      await writeFile(commitsPath, existing + '\n' + entry, 'utf-8');
    }
  }
}

// ---------------------------------------------------------------------------
// Milestones in main.md
// ---------------------------------------------------------------------------

/**
 * Update the Recent Milestones section in main.md. Keeps last `milestonesKept`.
 */
export async function updateMainMilestones(
  contextRoot: string,
  date: string,
  branch: string,
  title: string,
  milestonesKept: number = 5
): Promise<void> {
  try {
    const mainPath = join(contextRoot, 'main.md');
    if (!existsSync(mainPath)) return;

    let content = await readFile(mainPath, 'utf-8');
    const newEntry = `- ${date}: ${title} (${branch})`;

    const sectionStart = content.indexOf('## Recent Milestones');
    if (sectionStart === -1) return;

    const nextSection = content.indexOf('\n## ', sectionStart + 1);
    const sectionEnd = nextSection !== -1 ? nextSection : content.length;

    const section = content.slice(sectionStart, sectionEnd);
    const lines = section.split('\n').filter(l => l.startsWith('- ') && !l.includes('(none yet)'));

    const updated = [newEntry, ...lines].slice(0, milestonesKept);
    const newSection = `## Recent Milestones\n${updated.join('\n')}\n`;
    content = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);

    await writeFile(mainPath, content, 'utf-8');
  } catch {
    // Silent failure
  }
}

// ---------------------------------------------------------------------------
// main.md branch list management
// ---------------------------------------------------------------------------

/**
 * Add a branch name to the Open Branches section of main.md.
 */
export async function addBranchToMainMd(contextRoot: string, branchName: string): Promise<void> {
  try {
    const mainPath = join(contextRoot, 'main.md');
    if (!existsSync(mainPath)) return;

    let content = await readFile(mainPath, 'utf-8');
    const sectionStart = content.indexOf('## Open Branches');
    if (sectionStart === -1) return;

    // Remove "(none)" placeholder if present
    content = content.replace(/- \(none\)\n?/, '');

    const nextSection = content.indexOf('\n## ', sectionStart + 1);
    const sectionEnd = nextSection !== -1 ? nextSection : content.length;

    const before = content.slice(0, sectionEnd).trimEnd();
    const after = content.slice(sectionEnd);

    content = before + `\n- ${branchName}\n` + after;
    await writeFile(mainPath, content, 'utf-8');
  } catch {
    // Silent failure
  }
}

/**
 * Remove a branch name from the Open Branches section of main.md.
 */
export async function removeBranchFromMainMd(contextRoot: string, branchName: string): Promise<void> {
  try {
    const mainPath = join(contextRoot, 'main.md');
    if (!existsSync(mainPath)) return;

    let content = await readFile(mainPath, 'utf-8');
    const escaped = branchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    content = content.replace(new RegExp(`^- ${escaped}$\\n?`, 'm'), '');

    // If Open Branches section is now empty, add "(none)"
    const sectionStart = content.indexOf('## Open Branches');
    if (sectionStart !== -1) {
      const nextSection = content.indexOf('\n## ', sectionStart + 1);
      const sectionEnd = nextSection !== -1 ? nextSection : content.length;
      const sectionContent = content.slice(sectionStart + '## Open Branches'.length, sectionEnd).trim();
      if (!sectionContent || !sectionContent.includes('- ')) {
        const newSection = '## Open Branches\n- (none)\n';
        content = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);
      }
    }

    await writeFile(mainPath, content, 'utf-8');
  } catch {
    // Silent failure
  }
}

// ---------------------------------------------------------------------------
// Branch header (Purpose/Hypothesis/Conclusion) management
// ---------------------------------------------------------------------------

/**
 * Read the branch header block (everything before first ## [C###]) from a branch's commits.md.
 */
export function getBranchHeader(contextRoot: string, branchName: string): string | null {
  try {
    const commitsPath = getCommitsPath(contextRoot, branchName);
    if (!existsSync(commitsPath)) return null;

    const content = readFileSync(commitsPath, 'utf-8');
    const commitStart = content.indexOf('## [C');
    if (commitStart === -1) return content.trim() || null;
    return content.slice(0, commitStart).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Update the Conclusion section in a branch's commits.md header.
 */
export async function updateBranchConclusion(
  contextRoot: string,
  branchName: string,
  outcome: string,
  conclusion: string
): Promise<void> {
  const commitsPath = getCommitsPath(contextRoot, branchName);
  if (!existsSync(commitsPath)) return;

  let content = await readFile(commitsPath, 'utf-8');
  content = content.replace(
    /## Conclusion\n\(Fill in at merge time[^)]*\)/,
    `## Conclusion\n**Outcome**: ${outcome}\n${conclusion}`
  );
  await writeFile(commitsPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Read the main context file for session injection.
 */
export function readMainContext(contextRoot: string): string | null {
  try {
    const mainPath = join(contextRoot, 'main.md');
    if (!existsSync(mainPath)) return null;
    return readFileSync(mainPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Read the last N commit entries from a branch's commits.md.
 */
export function readRecentCommits(contextRoot: string, branch: string, count: number = 3): string {
  try {
    const commitsPath = getCommitsPath(contextRoot, branch);
    if (!existsSync(commitsPath)) return '';

    const content = readFileSync(commitsPath, 'utf-8');
    const entries = content.split(/(?=## \[C\d+\])/).filter(e => e.startsWith('## [C'));
    return entries.slice(0, count).join('\n');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Append a line to a branch's log.md. Auto-rotates at maxLines.
 */
export async function appendLog(
  contextRoot: string,
  branch: string,
  line: string,
  maxLines: number = 500
): Promise<void> {
  try {
    const logPath = getLogPath(contextRoot, branch);

    // Ensure branch directory exists
    const branchDir = getBranchDir(contextRoot, branch);
    if (!existsSync(branchDir)) {
      mkdirSync(branchDir, { recursive: true });
    }

    await appendFile(logPath, line + '\n', 'utf-8');

    // Rotate if needed
    if (existsSync(logPath)) {
      const content = await readFile(logPath, 'utf-8');
      const lines = content.split('\n');
      if (lines.length > maxLines) {
        await writeFile(logPath, lines.slice(-200).join('\n'), 'utf-8');
      }
    }
  } catch {
    // Fire-and-forget
  }
}

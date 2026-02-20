/**
 * Context file read/write helpers for GCC.
 *
 * Shared between hooks and extractor — encapsulates all file operations
 * on the .gcc/context/ directory.
 */

import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Get the next commit ID by reading the latest from commits.md.
 */
export function getNextCommitId(contextRoot: string): string {
  try {
    const commitsPath = join(contextRoot, 'commits.md');
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
 * Prepend a commit entry to commits.md (after the header).
 */
export async function prependCommit(contextRoot: string, entry: string): Promise<void> {
  const commitsPath = join(contextRoot, 'commits.md');
  const existing = existsSync(commitsPath)
    ? await readFile(commitsPath, 'utf-8')
    : '# Milestone Journal\n\n';

  const headerEnd = existing.indexOf('\n\n');
  if (headerEnd !== -1) {
    const header = existing.slice(0, headerEnd + 2);
    const body = existing.slice(headerEnd + 2);
    await writeFile(commitsPath, header + entry + body, 'utf-8');
  } else {
    await writeFile(commitsPath, existing + '\n' + entry, 'utf-8');
  }
}

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
 * Read the last N commit entries from commits.md.
 */
export function readRecentCommits(contextRoot: string, count: number = 3): string {
  try {
    const commitsPath = join(contextRoot, 'commits.md');
    if (!existsSync(commitsPath)) return '';

    const content = readFileSync(commitsPath, 'utf-8');
    const entries = content.split(/(?=## \[C\d+\])/).filter(e => e.startsWith('## [C'));
    return entries.slice(0, count).join('\n');
  } catch {
    return '';
  }
}

/**
 * Append a line to the OTA log. Auto-rotates at 500 lines.
 */
export async function appendLog(contextRoot: string, line: string): Promise<void> {
  try {
    const logPath = join(contextRoot, 'log.md');
    await appendFile(logPath, line + '\n', 'utf-8');

    // Rotate if needed
    if (existsSync(logPath)) {
      const content = await readFile(logPath, 'utf-8');
      const lines = content.split('\n');
      if (lines.length > 500) {
        await writeFile(logPath, lines.slice(-200).join('\n'), 'utf-8');
      }
    }
  } catch {
    // Fire-and-forget
  }
}

/**
 * Read/write the edit flag file.
 */
const EDIT_FLAG = '.edit-flag';

export interface EditFlagEntry {
  tool: string;
  file: string;
  timestamp: string;
}

export async function writeEditFlag(contextRoot: string, entry: EditFlagEntry): Promise<void> {
  const flagPath = join(contextRoot, EDIT_FLAG);
  const line = JSON.stringify(entry);
  await appendFile(flagPath, line + '\n', 'utf-8');
}

export function hasEditFlag(contextRoot: string): boolean {
  return existsSync(join(contextRoot, EDIT_FLAG));
}

export async function clearEditFlag(contextRoot: string): Promise<void> {
  const flagPath = join(contextRoot, EDIT_FLAG);
  if (existsSync(flagPath)) {
    await unlink(flagPath);
  }
}

/**
 * GCC v1 → v2 migration.
 *
 * Moves root-level commits.md and log.md into branches/main/.
 * Converts branch .md files into directories with their own commits.md + log.md.
 * Idempotent — uses .migrated-v2 marker to skip already-migrated contexts.
 */

import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_MARKER = '.migrated-v2';

/**
 * Check if this context root needs v1→v2 migration.
 * True if commits.md exists at root level (v1 layout).
 */
export function needsMigration(contextRoot: string): boolean {
  if (existsSync(join(contextRoot, MIGRATION_MARKER))) return false;
  return existsSync(join(contextRoot, 'commits.md'));
}

/**
 * Migrate a v1 context directory to v2 layout.
 * - Moves commits.md → branches/main/commits.md
 * - Moves log.md → branches/main/log.md
 * - Converts branches/{name}.md → branches/{name}/commits.md (with header preserved)
 * - Writes .migrated-v2 marker
 */
export function migrateV1ToV2(contextRoot: string): void {
  // Ensure branches/main/ exists
  const mainDir = join(contextRoot, 'branches', 'main');
  mkdirSync(mainDir, { recursive: true });

  // Move root commits.md → branches/main/commits.md
  const rootCommits = join(contextRoot, 'commits.md');
  const mainCommits = join(mainDir, 'commits.md');
  if (existsSync(rootCommits) && !existsSync(mainCommits)) {
    renameSync(rootCommits, mainCommits);
  } else if (existsSync(rootCommits)) {
    // Target exists — append root content to it
    const rootContent = readFileSync(rootCommits, 'utf-8');
    const existing = readFileSync(mainCommits, 'utf-8');
    writeFileSync(mainCommits, existing + '\n' + rootContent, 'utf-8');
    // Remove root file by renaming to a backup (safe)
    renameSync(rootCommits, rootCommits + '.v1-backup');
  }

  // Move root log.md → branches/main/log.md
  const rootLog = join(contextRoot, 'log.md');
  const mainLog = join(mainDir, 'log.md');
  if (existsSync(rootLog) && !existsSync(mainLog)) {
    renameSync(rootLog, mainLog);
  } else if (existsSync(rootLog)) {
    renameSync(rootLog, rootLog + '.v1-backup');
  }

  // Create empty log.md if it doesn't exist
  if (!existsSync(mainLog)) {
    writeFileSync(mainLog, '', 'utf-8');
  }

  // Convert branch .md files into directories
  const branchesDir = join(contextRoot, 'branches');
  if (existsSync(branchesDir)) {
    const entries = readdirSync(branchesDir);
    for (const entry of entries) {
      // Skip _registry.md, main/, and non-.md files
      if (entry === '_registry.md' || entry === 'main' || !entry.endsWith('.md')) continue;

      const branchFile = join(branchesDir, entry);
      const branchName = entry.replace(/\.md$/, '');
      const branchDir = join(branchesDir, branchName);

      // Skip if already a directory
      if (existsSync(branchDir)) continue;

      // Read the v1 branch file content (Purpose/Hypothesis/Findings/Conclusion)
      const content = readFileSync(branchFile, 'utf-8');

      // Create branch directory
      mkdirSync(branchDir, { recursive: true });

      // Convert v1 format to v2 format:
      // v1 had: # Branch: name, ## Purpose, ## Hypothesis, ## Findings, ## Conclusion
      // v2 puts header at top of commits.md, ## Findings content becomes part of the header
      const header = convertBranchHeader(content, branchName);
      writeFileSync(join(branchDir, 'commits.md'), header + '\n# Milestone Journal\n\n', 'utf-8');
      writeFileSync(join(branchDir, 'log.md'), '', 'utf-8');

      // Rename old file as backup
      renameSync(branchFile, branchFile + '.v1-backup');
    }
  }

  // Write migration marker
  writeFileSync(join(contextRoot, MIGRATION_MARKER), new Date().toISOString(), 'utf-8');
}

/**
 * Convert a v1 branch file's content into v2 header format.
 */
function convertBranchHeader(content: string, branchName: string): string {
  // Extract sections from v1 format
  const purpose = extractSection(content, 'Purpose') || '(migrated from v1)';
  const hypothesis = extractSection(content, 'Hypothesis') || '(migrated from v1)';
  const findings = extractSection(content, 'Findings');
  const conclusion = extractSection(content, 'Conclusion');

  let header = `# Branch: ${branchName}\n\n`;
  header += `## Purpose\n${purpose}\n\n`;
  header += `## Hypothesis\n${hypothesis}\n\n`;
  if (findings) {
    header += `## Findings\n${findings}\n\n`;
  }
  if (conclusion && !conclusion.includes('Fill in at merge time')) {
    header += `## Conclusion\n${conclusion}\n\n`;
  } else {
    header += `## Conclusion\n(Fill in at merge time — success/failure/partial)\n\n`;
  }
  header += '---\n\n';

  return header;
}

/**
 * Extract a markdown section's content by heading name.
 */
function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(regex);
  if (!match) return null;
  const text = match[1].trim();
  return text || null;
}

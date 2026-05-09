/**
 * Renders markdown views under .gcc/context/ from DB state.
 *
 * These files are derived — never hand-edited. They exist so Claude (and any
 * human inspection) can read project state without parsing SQLite.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Branch, Commit, GccDb, LogRow } from './index.js';

const MILESTONES_SHOWN = 5;
const COMMIT_DETAILS_SHOWN = 3;
const LOG_LINES_SHOWN = 500;

export async function renderAll(db: GccDb, contextRoot: string): Promise<void> {
  ensureDir(contextRoot);
  // allSettled so one bad branch can't tank the whole session-start context injection.
  const results = await Promise.allSettled([
    renderMain(db, contextRoot).catch(e => { throw new Error(`renderMain: ${e.message}`); }),
    renderRegistry(db, contextRoot).catch(e => { throw new Error(`renderRegistry: ${e.message}`); }),
    ...db.listAllBranches().map(b =>
      renderBranch(db, contextRoot, b).catch(e => { throw new Error(`renderBranch(${b.name}): ${e.message}`); })
    ),
  ]);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    for (const f of failures) {
      process.stderr.write(`[gcc] render warning: ${(f as PromiseRejectedResult).reason}\n`);
    }
  }
}

export async function renderMain(db: GccDb, contextRoot: string): Promise<void> {
  const focus = db.getMeta('current_focus') ?? '(Auto-created by GCC. Update with current goals.)';
  const recentGlobal = db.listRecentCommitsGlobal(MILESTONES_SHOWN);
  const openBranches = db.listOpenBranches();
  const recentDetails = db.listRecentCommitsGlobal(COMMIT_DETAILS_SHOWN);

  const milestonesSection = recentGlobal.length > 0
    ? recentGlobal.map(c => `- ${formatDate(c.ts)}: ${c.title} (${c.branch_name})`).join('\n')
    : '- (none yet)';

  const openBranchesSection = openBranches.length > 0
    ? openBranches.map(b => `- ${b.name}`).join('\n')
    : '- (none)';

  const detailsSection = recentDetails.length > 0
    ? recentDetails.map(renderCommitDetail).join('\n\n---\n\n\n')
    : '(no commits yet)';

  const content = `# Project Context

## Current Focus
${focus}

## Recent Milestones
${milestonesSection}

## Open Branches
${openBranchesSection}

## Recent Commit Details
${detailsSection}
`;

  await writeFile(join(contextRoot, 'main.md'), content, 'utf-8');
}

export async function renderRegistry(db: GccDb, contextRoot: string): Promise<void> {
  const active = db.getActiveBranch();
  const all = db.listAllBranches();

  const rows = all.map(b => `| ${b.name} | ${b.status} | ${formatDate(b.created_at)} |`).join('\n');

  const content = `## Active Branch
${active.name}

## Branch History
| Branch | Status | Created |
|--------|--------|---------|
${rows}
`;

  await mkdir(join(contextRoot, 'branches'), { recursive: true });
  await writeFile(join(contextRoot, 'branches', '_registry.md'), content, 'utf-8');
}

export async function renderBranch(db: GccDb, contextRoot: string, branch: Branch): Promise<void> {
  const dir = join(contextRoot, 'branches', branch.name);
  await mkdir(dir, { recursive: true });

  const commits = db.listCommitsByBranch(branch.name);
  const logs = db.listRecentLogs(branch.name, LOG_LINES_SHOWN);

  await Promise.all([
    writeFile(join(dir, 'commits.md'), renderBranchCommits(branch, commits), 'utf-8'),
    writeFile(join(dir, 'log.md'), renderBranchLog(logs), 'utf-8'),
  ]);
}

function renderBranchCommits(branch: Branch, commits: Commit[]): string {
  const milestones = commits.length > 0
    ? commits.map(renderCommitDetail).join('\n\n---\n\n\n')
    : '(no commits yet)';

  if (branch.name === 'main') {
    return `# Milestone Journal\n\n${milestones}\n`;
  }

  const conclusionBlock = renderConclusion(branch);
  const templateSections = renderTemplateSections(branch.template);
  const templateTag = branch.template ? ` [${branch.template}]` : '';

  return `# Branch: ${branch.name}${templateTag}

## Purpose
${branch.purpose ?? '(not set)'}

## Hypothesis
${branch.hypothesis ?? '(not set)'}
${templateSections}
## Conclusion
${conclusionBlock}

---

# Milestone Journal

${milestones}
`;
}

function renderConclusion(branch: Branch): string {
  if (!branch.conclusion) return '(Fill in at merge time — success/failure/partial)';
  const lines: string[] = [];
  lines.push(`**Outcome**: ${branch.outcome ?? 'unknown'}`);
  if (branch.confidence) lines.push(`**Confidence**: ${branch.confidence}`);
  lines.push(branch.conclusion);
  if (branch.evidence_files) {
    const files = branch.evidence_files.split('\n').filter(Boolean);
    if (files.length > 0) {
      lines.push(`**Evidence**:`);
      lines.push(...files.map(f => `- ${f}`));
    }
  }
  return lines.join('\n');
}

function renderTemplateSections(template: Branch['template']): string {
  if (!template) return '';
  switch (template) {
    case 'investigation':
      return `
## Evidence Log
(Append observations, logs, and findings as you investigate)
`;
    case 'feature':
      return `
## Acceptance Criteria
(List concrete conditions for "done")
`;
    case 'incident':
      return `
## Timeline
(Timestamped events: detection → diagnosis → mitigation → resolution)

## Impact
(Blast radius, affected systems, duration)
`;
    case 'refactor':
      return `
## Scope
(Files/modules in bounds)

## Risks
(What could go wrong, mitigations)
`;
    default:
      return '';
  }
}

function renderBranchLog(logs: LogRow[]): string {
  if (logs.length === 0) return '';
  const rendered = logs.reverse().map(l => {
    const ts = formatDateTime(l.ts);
    const parts = [ts, l.event];
    if (l.tool_name) parts.push(l.tool_name);
    if (l.summary) parts.push(l.summary);
    return `| ${parts.join(' | ')} |`;
  }).join('\n');
  return `| timestamp | event | detail | summary |\n|-----------|-------|--------|---------|\n${rendered}\n`;
}

function renderCommitDetail(c: Commit): string {
  const filesLine = c.files.length > 0 ? c.files.join(', ') : '(none)';
  const tagsLine = c.tags.length > 0 ? `\n**Tags**: ${c.tags.join(', ')}` : '';
  return `## [${c.commit_id}] ${formatDateTime(c.ts)} | branch:${c.branch_name} | ${c.title}
**What**: ${c.what}
**Why**: ${c.why}
**Files**: ${filesLine}
**Next**: ${c.next_step}${tagsLine}`;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

function ensureDir(contextRoot: string): void {
  if (!existsSync(contextRoot)) {
    mkdirSync(contextRoot, { recursive: true });
  }
}

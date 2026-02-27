/**
 * gcc_commit handler — record a milestone on the active branch.
 */

import { getActiveBranch, getNextCommitId, prependCommit, updateMainMilestones, appendLog } from '../../context.js';
import { loadConfig } from '../../config.js';
import { getGCCRoot } from './shared.js';

export interface CommitArgs {
  title: string;
  what: string;
  why: string;
  files_changed: string[];
  next_step: string;
}

export async function handleCommit(contextRoot: string, args: CommitArgs): Promise<string> {
  const { title, what, why, files_changed, next_step } = args;

  if (!title || !what || !why || !files_changed?.length || !next_step) {
    return 'Error: All fields are required (title, what, why, files_changed, next_step)';
  }

  const branch = getActiveBranch(contextRoot);
  const commitId = getNextCommitId(contextRoot, branch);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const filesStr = files_changed.join(', ');
  const entry = `## [${commitId}] ${timestamp} | branch:${branch} | ${title}
**What**: ${what}
**Why**: ${why}
**Files**: ${filesStr}
**Next**: ${next_step}

---

`;

  await prependCommit(contextRoot, branch, entry);

  const gccRoot = getGCCRoot(contextRoot);
  const cfg = loadConfig(gccRoot);
  await updateMainMilestones(contextRoot, timestamp.slice(0, 10), branch, title, cfg.milestonesKept);

  await appendLog(contextRoot, branch, `[${timestamp}] COMMIT ${commitId}: ${title}`);

  return `Committed ${commitId} on branch:${branch} — ${title}`;
}

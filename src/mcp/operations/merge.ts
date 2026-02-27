/**
 * gcc_merge handler — merge an exploration branch back to main.
 */

import {
  getActiveBranch,
  getNextCommitId,
  prependCommit,
  updateMainMilestones,
  updateRegistryActiveBranch,
  updateRegistryBranchStatus,
  removeBranchFromMainMd,
  updateBranchConclusion,
  appendLog,
} from '../../context.js';
import { loadConfig } from '../../config.js';
import { getGCCRoot } from './shared.js';

export interface MergeArgs {
  branch_name: string;
  outcome: 'success' | 'failure' | 'partial';
  conclusion: string;
}

export async function handleMerge(contextRoot: string, args: MergeArgs): Promise<string> {
  const { branch_name, outcome, conclusion } = args;

  if (branch_name === 'main') {
    return 'Error: Cannot merge main into itself. Only exploration branches can be merged.';
  }

  if (!branch_name || !outcome || !conclusion) {
    return 'Error: All fields are required (branch_name, outcome, conclusion)';
  }

  if (!['success', 'failure', 'partial'].includes(outcome)) {
    return 'Error: outcome must be one of: success, failure, partial';
  }

  // Must be on the named branch
  const activeBranch = getActiveBranch(contextRoot);
  if (activeBranch !== branch_name) {
    return `Error: Must be on branch '${branch_name}' to merge it. Currently on: ${activeBranch}`;
  }

  // Fill conclusion in branch commits.md header
  await updateBranchConclusion(contextRoot, branch_name, outcome, conclusion);

  // Create merge commit on main
  const commitId = getNextCommitId(contextRoot, 'main');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const entry = `## [${commitId}] ${timestamp} | branch:main | Merge: ${branch_name} (${outcome})
**What**: Merged exploration branch '${branch_name}'. ${conclusion}
**Why**: Consolidate findings from exploration.
**Files**: .gcc/context/branches/${branch_name}/
**Next**: Continue on main with findings applied.

---

`;

  await prependCommit(contextRoot, 'main', entry);

  // Update milestones
  const gccRoot = getGCCRoot(contextRoot);
  const cfg = loadConfig(gccRoot);
  await updateMainMilestones(contextRoot, timestamp.slice(0, 10), 'main', `Merge: ${branch_name} (${outcome})`, cfg.milestonesKept);

  // Switch back to main
  await updateRegistryActiveBranch(contextRoot, 'main');
  await updateRegistryBranchStatus(contextRoot, branch_name, 'merged');

  // Remove from Open Branches
  await removeBranchFromMainMd(contextRoot, branch_name);

  // Log on both branches
  await appendLog(contextRoot, branch_name, `[${timestamp}] MERGE ${outcome}: ${conclusion}`);
  await appendLog(contextRoot, 'main', `[${timestamp}] MERGE ${commitId}: ${branch_name} (${outcome})`);

  return `Merged '${branch_name}' (${outcome}) → main as ${commitId}. Back on branch:main.`;
}

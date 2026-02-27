/**
 * gcc_branch handler — create an exploration branch.
 */

import {
  getActiveBranch,
  updateRegistryActiveBranch,
  addBranchToRegistry,
  addBranchToMainMd,
  appendLog,
  getBranchDir,
} from '../../context.js';
import { ensureBranchDir } from '../../bootstrap.js';
import { existsSync } from 'node:fs';

export interface BranchArgs {
  name: string;
  purpose: string;
  hypothesis: string;
}

export async function handleBranch(contextRoot: string, args: BranchArgs): Promise<string> {
  const { name, purpose, hypothesis } = args;

  if (!name || !purpose || !hypothesis) {
    return 'Error: All fields are required (name, purpose, hypothesis)';
  }

  // Validate kebab-case
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    return 'Error: Branch name must be kebab-case (lowercase letters, numbers, hyphens). Example: explore-caching';
  }

  // Must be on main to create a branch
  const activeBranch = getActiveBranch(contextRoot);
  if (activeBranch !== 'main') {
    return `Error: Must be on main to create a branch. Currently on: ${activeBranch}. Merge it first with gcc_merge.`;
  }

  // Check if branch already exists
  const branchDir = getBranchDir(contextRoot, name);
  if (existsSync(branchDir)) {
    return `Error: Branch '${name}' already exists.`;
  }

  // Create branch directory with header
  ensureBranchDir(contextRoot, name, purpose, hypothesis);

  // Update registry
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  await updateRegistryActiveBranch(contextRoot, name);
  await addBranchToRegistry(contextRoot, name, date);

  // Update main.md
  await addBranchToMainMd(contextRoot, name);

  // Log
  await appendLog(contextRoot, name, `[${date}] BRANCH created: ${name} — ${purpose}`);

  return `Created branch '${name}'. Now on branch:${name}. Use gcc_commit to record milestones, gcc_merge when done.`;
}

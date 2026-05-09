/**
 * gcc_branch handler — create an exploration branch.
 */

import { createBranch, withDbRead } from '../../context.js';
import { getGCCRoot } from './shared.js';
import type { Branch } from '../../db/index.js';

export interface BranchArgs {
  name: string;
  purpose: string;
  hypothesis: string;
  template?: Branch['template'];
}

const VALID_TEMPLATES = ['investigation', 'feature', 'incident', 'refactor'];

export async function handleBranch(contextRoot: string, args: BranchArgs): Promise<string> {
  const { name, purpose, hypothesis, template } = args;

  if (!name || !purpose || !hypothesis) {
    return 'Error: All fields are required (name, purpose, hypothesis)';
  }

  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    return 'Error: Branch name must be kebab-case (lowercase letters, numbers, hyphens). Example: explore-caching';
  }

  if (template && !VALID_TEMPLATES.includes(template)) {
    return `Error: template must be one of: ${VALID_TEMPLATES.join(', ')}`;
  }

  const gccRoot = getGCCRoot(contextRoot);

  const { activeBranch, alreadyExists } = withDbRead(gccRoot, (db) => ({
    activeBranch: db.getActiveBranch().name,
    alreadyExists: !!db.getBranchByName(name),
  }));

  if (activeBranch !== 'main') {
    return `Error: Must be on main to create a branch. Currently on: ${activeBranch}. Merge it first with gcc_merge.`;
  }
  if (alreadyExists) {
    return `Error: Branch '${name}' already exists.`;
  }

  await createBranch(gccRoot, { name, purpose, hypothesis, template });
  const templateSuffix = template ? ` [${template}]` : '';
  return `Created branch '${name}'${templateSuffix}. Now on branch:${name}. Use gcc_commit to record milestones, gcc_merge when done.`;
}

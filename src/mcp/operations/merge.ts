/**
 * gcc_merge handler — merge an exploration branch back to main.
 */

import { mergeBranch, withDbRead } from '../../context.js';
import { getGCCRoot } from './shared.js';

export interface MergeArgs {
  branch_name: string;
  outcome: 'success' | 'failure' | 'partial';
  conclusion: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence_files?: string[];
}

export async function handleMerge(contextRoot: string, args: MergeArgs): Promise<string> {
  const { branch_name, outcome, conclusion, confidence, evidence_files } = args;

  if (branch_name === 'main') {
    return 'Error: Cannot merge main into itself. Only exploration branches can be merged.';
  }
  if (!branch_name || !outcome || !conclusion) {
    return 'Error: All fields are required (branch_name, outcome, conclusion)';
  }
  if (!['success', 'failure', 'partial'].includes(outcome)) {
    return 'Error: outcome must be one of: success, failure, partial';
  }
  if (confidence && !['high', 'medium', 'low'].includes(confidence)) {
    return 'Error: confidence must be one of: high, medium, low';
  }

  const gccRoot = getGCCRoot(contextRoot);

  const activeBranch = withDbRead(gccRoot, (db) => db.getActiveBranch().name);
  if (activeBranch !== branch_name) {
    return `Error: Must be on branch '${branch_name}' to merge it. Currently on: ${activeBranch}`;
  }

  const commit = await mergeBranch(gccRoot, {
    branchName: branch_name,
    outcome,
    conclusion,
    confidence,
    evidenceFiles: evidence_files,
  });
  return `Merged '${branch_name}' (${outcome}${confidence ? `, ${confidence}` : ''}) → main as ${commit.commit_id}. Back on branch:main.`;
}

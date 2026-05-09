/**
 * gcc_commit handler — record a milestone on the active branch.
 */

import { insertCommit } from '../../context.js';
import { getGCCRoot } from './shared.js';

export interface CommitArgs {
  title: string;
  what: string;
  why: string;
  files_changed: string[];
  next_step: string;
  tags?: string[];
}

export async function handleCommit(contextRoot: string, args: CommitArgs): Promise<string> {
  const { title, what, why, files_changed, next_step, tags } = args;

  if (!title || !what || !why || !files_changed?.length || !next_step) {
    return 'Error: All fields are required (title, what, why, files_changed, next_step)';
  }

  const files = files_changed.map(f => f.trim()).filter(Boolean);
  if (!files.length) {
    return 'Error: files_changed must contain at least one non-empty path';
  }

  const gccRoot = getGCCRoot(contextRoot);
  const commit = await insertCommit(gccRoot, {
    title, what, why, next_step,
    files,
    tags,
  });

  return `Committed ${commit.commit_id} on branch:${commit.branch_name} — ${commit.title}`;
}

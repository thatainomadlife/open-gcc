/**
 * MCP tool dispatch — routes tool calls to operation handlers.
 */

import { existsSync } from 'node:fs';
import { getContextRoot, getGCCRoot, ensureGCCRoot } from '../util.js';
import { needsMigration, migrateV1ToV2 } from '../migrate.js';
import { handleCommit, type CommitArgs } from './operations/commit.js';
import { handleBranch, type BranchArgs } from './operations/branch.js';
import { handleMerge, type MergeArgs } from './operations/merge.js';
import { handleContext, type ContextArgs } from './operations/context.js';
import { handleStatus, type StatusArgs } from './operations/status.js';
import { handleSearch, type SearchArgs } from './operations/search.js';

export async function dispatch(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const gccRoot = getGCCRoot(cwd);
    const isFirstInit = !existsSync(gccRoot);

    ensureGCCRoot(cwd);

    const contextRoot = getContextRoot(cwd);

    if (needsMigration(contextRoot)) {
      migrateV1ToV2(contextRoot);
    }

    let result: string;
    switch (toolName) {
      case 'gcc_commit':
        result = await handleCommit(contextRoot, args as unknown as CommitArgs);
        break;
      case 'gcc_branch':
        result = await handleBranch(contextRoot, args as unknown as BranchArgs);
        break;
      case 'gcc_merge':
        result = await handleMerge(contextRoot, args as unknown as MergeArgs);
        break;
      case 'gcc_context':
        result = await handleContext(contextRoot, args as unknown as ContextArgs);
        break;
      case 'gcc_status':
        result = await handleStatus(contextRoot, args as unknown as StatusArgs);
        break;
      case 'gcc_search':
        result = await handleSearch(contextRoot, args as unknown as SearchArgs);
        break;
      default:
        result = `Unknown tool: ${toolName}`;
    }

    if (isFirstInit) {
      result = `✦ GCC initialized for this project (.gcc/ created, .gitignore updated).\n\n${result}`;
    }

    return { content: [{ type: 'text' as const, text: result }] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: [{ type: 'text' as const, text: `GCC Error: ${message}` }] };
  }
}

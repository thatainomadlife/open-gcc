/**
 * MCP tool dispatch — routes tool calls to operation handlers.
 */

import { getContextRoot } from '../util.js';
import { ensureContextStructure } from '../bootstrap.js';
import { needsMigration, migrateV1ToV2 } from '../migrate.js';
import { handleCommit, type CommitArgs } from './operations/commit.js';
import { handleBranch, type BranchArgs } from './operations/branch.js';
import { handleMerge, type MergeArgs } from './operations/merge.js';
import { handleContext, type ContextArgs } from './operations/context.js';

/**
 * Dispatch a tool call to the appropriate handler.
 * All handlers are pure functions: contextRoot + args → result string.
 */
export async function dispatch(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    // Resolve context root from environment
    const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const contextRoot = getContextRoot(cwd);

    // Run migration if needed
    if (needsMigration(contextRoot)) {
      migrateV1ToV2(contextRoot);
    }

    // Ensure structure exists
    ensureContextStructure(contextRoot);

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
      default:
        result = `Unknown tool: ${toolName}`;
    }

    return {
      content: [{ type: 'text' as const, text: result }],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: 'text' as const, text: `GCC Error: ${message}` }],
    };
  }
}

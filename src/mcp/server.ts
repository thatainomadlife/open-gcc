/**
 * GCC MCP Server — entry point.
 *
 * Exposes 4 tools via stdio transport:
 * - gcc_commit: Record a milestone
 * - gcc_branch: Create exploration branch
 * - gcc_merge: Consolidate branch findings
 * - gcc_context: Progressive context retrieval
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { dispatch } from './handlers.js';

const server = new McpServer(
  { name: 'gcc-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

// gcc_commit
server.tool(
  'gcc_commit',
  'Record a milestone in the GCC context. Call this after completing a subtask, fixing a bug, reaching a checkpoint, or every 15-30 minutes of active work. Creates a structured commit entry on the active branch with auto-generated ID and timestamp. Updates the project\'s main.md milestones summary. Use PROACTIVELY — don\'t wait to be asked.',
  {
    title: z.string().describe('Short milestone title, 5-10 words (e.g. \'Fixed auth token refresh logic\')'),
    what: z.string().describe('What was accomplished in 1-2 sentences — be specific about the change'),
    why: z.string().describe('Why this matters for the project — the impact, not just the action'),
    files_changed: z.array(z.string()).describe('Paths of key files modified. Must include at least one file.'),
    next_step: z.string().describe('Immediate next action in 1 sentence'),
  },
  async (args) => dispatch('gcc_commit', args)
);

// gcc_branch
server.tool(
  'gcc_branch',
  'Create an exploration branch for uncertain approaches, investigations, or hypotheses. Use BEFORE starting work you might abandon — trying a new architecture, debugging an unknown issue, comparing alternatives. Must be on main branch. Switches active context to the new branch so subsequent gcc_commit calls record on it.',
  {
    name: z.string().describe('Branch name in kebab-case (lowercase letters and hyphens only, e.g. \'fix-auth-flow\')'),
    purpose: z.string().describe('What we are exploring and why'),
    hypothesis: z.string().describe('What we expect to find or prove'),
  },
  async (args) => dispatch('gcc_branch', args)
);

// gcc_merge
server.tool(
  'gcc_merge',
  'Merge an exploration branch back to main and consolidate findings. Call when investigation is complete — whether it succeeded, failed, or was partially useful. Records conclusion in branch header, creates merge commit on main, switches back to main. Must be on the branch being merged (not main).',
  {
    branch_name: z.string().describe('Name of the branch to merge'),
    outcome: z.enum(['success', 'failure', 'partial']).describe('Result of the exploration'),
    conclusion: z.string().describe('Key takeaway from the exploration'),
  },
  async (args) => dispatch('gcc_merge', args)
);

// gcc_context
server.tool(
  'gcc_context',
  'Retrieve project context at varying levels of detail. Use at session start, after context compaction, when resuming work, or whenever you need to recall what was happening. Levels: 1=project focus only (~200 tokens), 2=+recent commits (~600 tokens), 3=+branch purpose/hypothesis (~800 tokens), 4=+extended history (~1500 tokens), 5=+specific commit lookup or keyword search.',
  {
    level: z.number().min(1).max(5).describe('Detail level 1-5. Start with 2. Each level includes all lower levels.'),
    branch: z.string().optional().describe('Branch to read from (defaults to active branch)'),
    commit_id: z.string().optional().describe('Specific commit ID to retrieve (level 5 only)'),
    metadata_segment: z.string().optional().describe('Search term to find in commits (level 5 only)'),
  },
  async (args) => dispatch('gcc_context', args)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`GCC MCP server error: ${e}\n`);
  process.exit(1);
});

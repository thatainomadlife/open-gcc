/**
 * GCC MCP Server — entry point.
 *
 * Exposes 6 tools via stdio transport:
 * - gcc_commit: Record a milestone (supports tags)
 * - gcc_branch: Create exploration branch (supports template)
 * - gcc_merge: Consolidate branch findings (supports confidence + evidence)
 * - gcc_context: Progressive context retrieval
 * - gcc_status: Quick status check
 * - gcc_search: Full-text search across commits
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { dispatch } from './handlers.js';

const server = new McpServer(
  { name: 'gcc-mcp', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

/**
 * Lenient string-array schema. Some MCP clients/transports stringify array
 * params during the JSON-RPC handoff, so a native array like ["a","b"] arrives
 * server-side as the string "[\"a\",\"b\"]". Accept both forms — defense in
 * depth keeps gcc_commit / gcc_merge usable across all clients.
 */
const stringArray = z.union([
  z.array(z.string()),
  z.string().transform((s, ctx) => {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected array of strings or JSON-encoded array of strings',
      });
      return z.NEVER;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected array of strings or valid JSON array string',
      });
      return z.NEVER;
    }
  }),
]);

server.tool(
  'gcc_commit',
  'Record a milestone in the GCC context. Call this after completing a subtask, fixing a bug, reaching a checkpoint, or every 15-30 minutes of active work. Creates a structured commit entry on the active branch with auto-generated ID and timestamp. Updates the project\'s main.md milestones summary. Use PROACTIVELY — don\'t wait to be asked.',
  {
    title: z.string().describe('Short milestone title, 5-10 words (e.g. \'Fixed auth token refresh logic\')'),
    what: z.string().describe('What was accomplished in 1-2 sentences — be specific about the change'),
    why: z.string().describe('Why this matters for the project — the impact, not just the action'),
    files_changed: stringArray.describe('Paths of key files modified. Must include at least one file.'),
    next_step: z.string().describe('Immediate next action in 1 sentence'),
    tags: stringArray.optional().describe('Optional freeform tags (lowercased, e.g. ["malware", "infra", "honeypot"]) — enable topic-based search via gcc_search'),
  },
  async (args) => dispatch('gcc_commit', args)
);

server.tool(
  'gcc_branch',
  'Create an exploration branch for uncertain approaches, investigations, or hypotheses. Use BEFORE starting work you might abandon — trying a new architecture, debugging an unknown issue, comparing alternatives. Must be on main branch. Switches active context to the new branch so subsequent gcc_commit calls record on it. Optional template structures the branch for different work modes.',
  {
    name: z.string().describe('Branch name in kebab-case (lowercase letters and hyphens only, e.g. \'fix-auth-flow\')'),
    purpose: z.string().describe('What we are exploring and why'),
    hypothesis: z.string().describe('What we expect to find or prove'),
    template: z.enum(['investigation', 'feature', 'incident', 'refactor']).optional().describe('Optional work-mode template. investigation=hypothesis-driven with evidence log; feature=scope + acceptance criteria; incident=time-pressured with timeline; refactor=scope + risks.'),
  },
  async (args) => dispatch('gcc_branch', args)
);

server.tool(
  'gcc_merge',
  'Merge an exploration branch back to main and consolidate findings. Call when investigation is complete — whether it succeeded, failed, or was partially useful. Records conclusion in branch header, creates merge commit on main, switches back to main. Must be on the branch being merged (not main).',
  {
    branch_name: z.string().describe('Name of the branch to merge'),
    outcome: z.enum(['success', 'failure', 'partial']).describe('Result of the exploration'),
    conclusion: z.string().describe('Key takeaway from the exploration'),
    confidence: z.enum(['high', 'medium', 'low']).optional().describe('Confidence in the conclusion'),
    evidence_files: stringArray.optional().describe('Files or artifacts that support the conclusion (logs, test outputs, benchmarks)'),
  },
  async (args) => dispatch('gcc_merge', args)
);

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

server.tool(
  'gcc_status',
  'Quick status check — returns active branch, last commit, tool operations since last commit, time since last commit, and open branches. Zero-arg, instant orientation. Use when you need a fast "where am I?" without full context retrieval.',
  {},
  async (args) => dispatch('gcc_status', args)
);

server.tool(
  'gcc_search',
  'Full-text search across all recorded commits. Uses SQLite FTS5 — supports quoted phrases, AND/OR/NOT operators, and prefix matching with *. Results are ranked by relevance. Optional filters by tag or branch. Use when trying to recall prior work on a topic without having to scroll through gcc_context.',
  {
    query: z.string().describe('Search query. Examples: "redis timeout", "honeypot AND malware", "auth*"'),
    limit: z.number().optional().describe('Max results (default 10)'),
    tag: z.string().optional().describe('Filter by commit tag'),
    branch: z.string().optional().describe('Filter by branch name'),
  },
  async (args) => dispatch('gcc_search', args)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`GCC MCP server error: ${e}\n`);
  process.exit(1);
});

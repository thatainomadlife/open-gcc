# Contributing to GCC

## Development Setup

```bash
git clone https://github.com/thatainomadlife/open-gcc.git
cd claude-gcc
npm install
npm run build
```

## Building

```bash
npm run build      # Compile hooks + bundle MCP server
npm run dev        # Watch mode (hooks only — re-run `npm run build` for MCP changes)
```

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Project Structure

```
src/
├── config.ts           # Configuration loading (.gcc/config.json)
├── context.ts          # Context file read/write operations
├── bootstrap.ts        # Context directory initialization
├── migrate.ts          # v1 → v2 migration
├── util.ts             # Shared utilities
├── hooks/
│   ├── session-start.ts    # Inject context + MCP tool references
│   ├── post-tool-use.ts    # Log tool operations to branch log
│   ├── user-prompt-submit.ts  # Lightweight MCP tool reminder
│   ├── stop.ts             # Session-end logging (audit trail)
│   └── pre-compact.ts      # Nudge to commit before compaction
└── mcp/
    ├── server.ts           # MCP server entry point (4 tools)
    ├── handlers.ts         # Tool dispatch router
    └── operations/
        ├── shared.ts       # Shared MCP utilities
        ├── commit.ts       # gcc_commit handler
        ├── branch.ts       # gcc_branch handler
        ├── merge.ts        # gcc_merge handler
        └── context.ts      # gcc_context handler

tests/
├── config.test.ts      # Config loading and defaults
├── context.test.ts     # Commit IDs, prepend, milestones, branch registry
├── bootstrap.test.ts   # Init, partial init recovery
├── util.test.ts        # Error logging, path resolution, stdin parsing
├── migrate.test.ts     # v1 → v2 migration
└── mcp/
    ├── commit.test.ts  # gcc_commit handler
    ├── branch.test.ts  # gcc_branch handler
    ├── merge.test.ts   # gcc_merge handler
    └── context.test.ts # gcc_context handler

skills/                 # Claude Code skill definitions
├── commit/SKILL.md
├── branch/SKILL.md
├── merge/SKILL.md
└── context/SKILL.md

scripts/
└── bundle-mcp.mjs     # esbuild bundler for MCP server
```

## Pull Request Guidelines

1. Run `npm run build` — must compile with zero errors
2. Run `npm test` — all tests must pass
3. Keep changes focused — one feature or fix per PR
4. Follow existing code patterns (no classes where functions work, no unnecessary abstractions)

## Design Principles

- **Zero runtime dependencies** — devDependencies (TypeScript, vitest, esbuild, MCP SDK, zod) are bundled at build time
- **Silent failures** — hooks never block Claude Code
- **Human-readable state** — all context is plain markdown
- **Minimal abstractions** — functions over classes, direct over clever

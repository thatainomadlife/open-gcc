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
npm run build      # Compile TypeScript to dist/
npm run dev        # Watch mode for development
```

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Project Structure

```
src/
├── provider.ts         # LLM provider abstraction (OpenAI/Anthropic/Ollama)
├── config.ts           # Configuration loading (.gcc/config.json + env vars)
├── extractor.ts        # Milestone extraction from transcripts
├── context.ts          # Context file read/write operations
├── bootstrap.ts        # Context directory initialization
├── util.ts             # Shared utilities
└── hooks/
    ├── session-start.ts  # Inject context at session start
    ├── post-tool-use.ts  # Track edits (Edit/Write/NotebookEdit)
    ├── stop.ts           # Auto-extract on turn completion
    └── pre-compact.ts    # Safety net before context compaction

tests/
├── provider.test.ts    # Provider resolution + API call mocking
├── config.test.ts      # Config loading, defaults, env overrides
├── context.test.ts     # Commit IDs, prepend, milestones, branch registry
├── bootstrap.test.ts   # Init, partial init recovery
├── util.test.ts        # Cooldown, error logging, path resolution
└── extractor.test.ts   # End-to-end extraction with mocked LLM

skills/                 # Claude Code skill definitions
├── commit/SKILL.md
├── branch/SKILL.md
├── merge/SKILL.md
└── context/SKILL.md
```

## Pull Request Guidelines

1. Run `npm run build` — must compile with zero errors
2. Run `npm test` — all tests must pass
3. Keep changes focused — one feature or fix per PR
4. Follow existing code patterns (no classes where functions work, no unnecessary abstractions)

## Design Principles

- **Zero runtime dependencies** — only dev dependencies (TypeScript, vitest)
- **Silent failures** — hooks never block Claude Code
- **Human-readable state** — all context is plain markdown
- **Minimal abstractions** — functions over classes, direct over clever

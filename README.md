# GCC — Git-style Context Controller for Claude Code

Automatic session continuity through structured milestone tracking. No databases. No servers. No background processes. No cloud accounts. No subscriptions. Just markdown files that humans can read and git can track.

**Zero runtime dependencies.** Not "lightweight." Not "minimal." *Zero.*

## Why GCC?

Claude Code sessions are ephemeral. Context compacts. Sessions end. When you come back, Claude has no idea what you were doing.

GCC solves this with a git-inspired workflow:

- **Commits** record what was done, why, and what's next
- **Branches** track exploration of uncertain approaches
- **Merges** consolidate findings back to main context
- **Auto-extraction** uses an LLM to summarize your work after every edit

All state lives in `.gcc/context/` as plain markdown — readable by humans, trackable by git, zero runtime dependencies.

## The Competitive Landscape (Or: Why GCC Exists)

There are other tools in this space. Let's be honest about them.

| | GCC | OneContext | claude-mem | Context Manager |
|---|---|---|---|---|
| **Runtime deps** | **0** | Cloud backend | SQLite + ChromaDB | macOS app |
| **Storage** | Markdown files | Their servers | Vector database | Reads your Claude data |
| **Actually open source** | MIT. The whole thing. | "Open source" but needs their cloud service | AGPL + PolyForm Noncommercial (the RAG module restricts commercial use — read the fine print) | Closed source. $29. |
| **Install** | `git clone && ./install.sh` | OAuth signup + cloud sync | Background HTTP server on port 37777 | Download .dmg, macOS only |
| **Works offline** | Yes. Always. | No (cloud sync required) | Yes (local DB) | Yes (local app) |
| **Git metaphor** | Commit/branch/merge | No | No | Git-aware but no workflow |
| **Context approach** | Intentional commits + auto-extraction | Automatic recording | Automatic compression + vector retrieval | Session monitoring |
| **You own your data** | It's markdown files in your repo | It's on their servers | It's in a SQLite database | It reads from Claude's directories |
| **Platform** | Anywhere Node 18 runs | Anywhere (cloud) | Anywhere (server) | macOS only |

### A note on "open source"

We love open source. Real open source. MIT, Apache 2.0, BSD — licenses that actually let you do whatever you want.

Some projects in this space call themselves "open source" while:
- Requiring a cloud backend they control (your context, their servers)
- Using AGPL with additional noncommercial restrictions on key components (open source until you try to use it commercially)
- Publishing code you can read but can't meaningfully run without their infrastructure

GCC is MIT licensed. All of it. No cloud. No phone-home. No "open core" where the good parts cost money. Your context data is markdown files sitting in your project directory. `cat` them. `grep` them. Commit them to git. Copy them to a USB drive. We don't care — they're yours.

## Quick Start

```bash
git clone https://github.com/thatainomadlife/open-gcc.git
cd claude-gcc
./install.sh
```

That's it. GCC activates automatically in every project on your next Claude Code session.

### LLM Provider Setup (for auto-extraction)

Set one of these environment variables for automatic milestone extraction:

```bash
# Option 1: OpenAI (default — gpt-4.1-nano)
export OPENAI_API_KEY=sk-...

# Option 2: Anthropic (claude-haiku-4-5)
export ANTHROPIC_API_KEY=sk-ant-...

# Option 3: Ollama (local, free, private)
export GCC_OLLAMA_URL=http://localhost:11434
```

No API key? No problem. GCC still works — auto-extraction is disabled but manual `/gcc-commit` works fine. No errors, no nags, no degraded experience.

## How It Works

```
Session Start
  │
  ├─ SessionStart Hook
  │    └─ Injects project context (main.md + recent commits) into Claude's prompt
  │
  ├─ [You work, Claude edits files]
  │
  ├─ PostToolUse Hook (on Edit/Write/NotebookEdit)
  │    └─ Sets edit flag + logs operation
  │
  ├─ Stop Hook (turn ends)
  │    └─ If edits happened → LLM extracts milestone → writes to commits.md
  │
  └─ PreCompact Hook (before context compaction)
       └─ Safety net — always extracts before context is lost
```

### What gets created

```
your-project/
└── .gcc/
    ├── context/
    │   ├── main.md              # Project focus, milestones, open branches
    │   ├── commits.md           # Milestone journal (newest first)
    │   ├── branches/
    │   │   ├── _registry.md     # Active branch tracker
    │   │   └── {branch}.md      # Individual explorations
    │   └── log.md               # Operation tracking
    ├── config.json              # Optional configuration
    └── error.log                # Error log (auto-rotated)
```

All files are human-readable markdown. Read them. Edit them. They're yours.

## Skills

| Skill | Description |
|---|---|
| `/gcc-commit <title>` | Record a named milestone manually |
| `/gcc-branch <name>` | Start an exploration branch |
| `/gcc-merge` | Merge branch findings back to main |
| `/gcc-context` | Recall project state |

## Configuration

Create `.gcc/config.json` in any project (optional — sensible defaults work out of the box):

```json
{
  "provider": "openai",
  "model": "gpt-4.1-nano",
  "cooldownSeconds": 120,
  "maxMessages": 30,
  "maxMessageLength": 1000,
  "recentCommitCount": 3,
  "milestonesKept": 5,
  "autoExtract": true
}
```

### Environment Variable Overrides

| Variable | Description |
|---|---|
| `GCC_PROVIDER` | Force provider: `openai`, `anthropic`, `ollama` |
| `GCC_MODEL` | Override model for any provider |
| `GCC_COOLDOWN` | Extraction cooldown in seconds |
| `GCC_AUTO_EXTRACT` | `true`/`false` — enable/disable auto-extraction |
| `GCC_OLLAMA_URL` | Ollama server URL |
| `GCC_OLLAMA_MODEL` | Ollama model name (default: `llama3.2`) |

Environment variables override `config.json`, which overrides defaults.

## Uninstall

```bash
cd claude-gcc
./uninstall.sh          # Remove hooks and skills
./uninstall.sh --purge  # Also remove all .gcc/ directories
```

## Development

```bash
git clone https://github.com/thatainomadlife/open-gcc.git
cd claude-gcc
npm install
npm run build    # Compile TypeScript
npm test         # Run tests (58 tests, <1s)
npm run dev      # Watch mode
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — the whole thing, not just the parts we want you to see.

# GCC — Git-style Context Controller for Claude Code

Automatic session continuity through structured milestone tracking. No databases. No servers. No background processes. No cloud accounts. No subscriptions. Just markdown files that humans can read and git can track.

**Zero runtime dependencies.** Not "lightweight." Not "minimal." *Zero.*

## Why GCC?

Claude Code sessions are ephemeral. Context compacts. Sessions end. When you come back, Claude has no idea what you were doing.

GCC solves this with a git-inspired workflow:

- **Commits** record what was done, why, and what's next
- **Branches** track exploration of uncertain approaches
- **Merges** consolidate findings back to main context
- **MCP tools** let Claude manage context autonomously — no LLM extraction needed

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
| **Context approach** | MCP tools + hook nudges | Automatic recording | Automatic compression + vector retrieval | Session monitoring |
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

That's it. The installer builds, wires hooks, symlinks skills, and registers the MCP server. GCC activates automatically in every project on your next Claude Code session.

## How It Works

GCC v2 is **agent-driven**: Claude calls MCP tools directly to manage context. Hooks inject context at session start and nudge Claude to commit — but never make LLM calls themselves.

```
Session Start
  │
  ├─ SessionStart Hook
  │    └─ Injects project context (main.md + recent commits) + MCP tool references
  │
  ├─ [You work, Claude edits files]
  │
  ├─ PostToolUse Hook (on Edit/Write/NotebookEdit/Bash)
  │    └─ Logs tool operation to active branch's log.md
  │
  ├─ UserPromptSubmit Hook
  │    └─ Injects lightweight tool reminder (keeps MCP tool names in context)
  │
  ├─ Stop Hook (turn ends)
  │    └─ Logs session end to active branch's log.md (audit trail)
  │
  └─ PreCompact Hook (before context compaction)
       └─ Reminds Claude to commit before context is lost
```

### MCP Tools

Claude calls these autonomously via the `gcc-mcp` MCP server:

| Tool | Description |
|---|---|
| `gcc_commit` | Record a milestone after completing subtasks, fixing bugs, or reaching checkpoints. Use proactively. |
| `gcc_branch` | Create an exploration branch before uncertain/speculative work. Must be on main. |
| `gcc_merge` | Consolidate branch findings when exploration is complete. Must be on the branch. |
| `gcc_context` | Recall project state at session start, after compaction, or when context is unclear. Levels 1-5. |

### What gets created

```
your-project/
└── .gcc/
    ├── context/
    │   ├── main.md              # Project focus, milestones, open branches
    │   ├── branches/
    │   │   ├── _registry.md     # Active branch tracker + history
    │   │   ├── main/
    │   │   │   ├── commits.md   # Milestone journal (newest first)
    │   │   │   └── log.md       # Operation log
    │   │   └── {branch}/
    │   │       ├── commits.md   # Branch header + milestones
    │   │       └── log.md       # Branch operation log
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
  "recentCommitCount": 3,
  "milestonesKept": 5,
  "logMaxLines": 500
}
```

| Key | Default | Description |
|---|---|---|
| `recentCommitCount` | 3 | Number of recent commits injected at session start |
| `milestonesKept` | 5 | Max milestones shown in main.md Recent Milestones section |
| `logMaxLines` | 500 | Auto-rotate log after this many lines |

## Uninstall

```bash
cd claude-gcc
./uninstall.sh          # Remove hooks, skills, and MCP server
./uninstall.sh --purge  # Also remove all .gcc/ directories
```

## Development

```bash
git clone https://github.com/thatainomadlife/open-gcc.git
cd claude-gcc
npm install
npm run build    # Compile TypeScript
npm test         # Run tests (~83 tests, <1s)
npm run dev      # Watch mode
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — the whole thing, not just the parts we want you to see.

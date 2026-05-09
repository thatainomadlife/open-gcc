# GCC — Git-style Context Controller for Claude Code

Automatic session continuity through structured milestone tracking. SQLite under the hood, markdown views on top. No servers. No cloud accounts. No subscriptions. Files `cat` can read, `git` can track, and `grep` can search — with a real query engine when you want one.

**Zero runtime dependencies.** v3 uses Node 22+'s built-in `node:sqlite`. No `better-sqlite3`, no native builds, no npm install footprint.

## Why GCC?

Claude Code sessions are ephemeral. Context compacts. Sessions end. When you come back, Claude has no idea what you were doing.

GCC solves this with a git-inspired workflow:

- **Commits** record what was done, why, and what's next (with optional tags)
- **Branches** track exploration of uncertain approaches (with optional work-mode templates)
- **Merges** consolidate findings with confidence + evidence (audit-grade conclusions)
- **Search** across everything via SQLite FTS5
- **MCP tools** let Claude manage context autonomously
- **CLI** (`gcc`) lets *you* inspect state without a Claude session

State lives in `.gcc/state.db` (SQLite — source of truth) and `.gcc/context/*.md` (derived views — still readable by humans, trackable by git).

## Quick Start

```bash
git clone https://github.com/thatainomadlife/open-gcc.git
cd claude-gcc
./install.sh
```

The installer builds, wires all 28 documented Claude Code hook events, symlinks 6 skills, registers the MCP server, and puts `gcc` on your PATH. GCC activates automatically in every project on your next Claude Code session.

**Requirements:** Node ≥22 (for built-in `node:sqlite`), `npm`, `jq`.

## MCP Tools (Claude-facing)

Claude calls these autonomously via the `gcc-mcp` MCP server:

| Tool | What it does |
|---|---|
| `gcc_commit` | Record a milestone. Accepts `title`, `what`, `why`, `files_changed`, `next_step`, optional `tags`. |
| `gcc_branch` | Create an exploration branch. Accepts `name`, `purpose`, `hypothesis`, optional `template` (`investigation`\|`feature`\|`incident`\|`refactor`). |
| `gcc_merge` | Consolidate a branch to main. Accepts `branch_name`, `outcome`, `conclusion`, optional `confidence` + `evidence_files`. |
| `gcc_context` | Recall project state at levels 1-5 (progressive detail). |
| `gcc_status` | Quick "where am I?" — active branch, last commit, ops since commit, open branches, recent hook errors. |
| `gcc_search` | Full-text search across all commits. SQLite FTS5 (`AND`/`OR`/`NOT`/`"phrase"`/`prefix*`). Optional tag/branch filters. |

## CLI (you-facing)

```
gcc status                         # Dashboard: branch, last commit, errors
gcc log [-b branch] [-n 50]        # Recent hook event log
gcc search <query> [-t tag] [-v]   # FTS5 search (supports AND/OR/NOT/quotes/prefix*)
gcc commits [-b branch] [-n 20] [-v]
gcc tags                           # Tag frequency table
gcc branches [-a]                  # List branches (-a for merged/abandoned)
gcc export [--since 7d] [--format markdown|json]   # Dump commits
gcc help
```

Use `--gcc-root <path>` to point at a specific project, or rely on `CLAUDE_PROJECT_DIR` / cwd.

### CLI examples

```bash
gcc status                                      # current project snapshot
gcc search "honeypot AND mirai" -v              # FTS5 with verbose output
gcc search redis -t infra                       # tag-filtered
gcc export --since 30d --format json | jq .     # pipe to anything
gcc log -n 200 -b feature-auth                  # branch audit trail
```

## Hook Lifecycle (28 events — full coverage)

GCC listens on every Claude Code hook event and logs structurally to SQLite:

```
Session lifecycle:   SessionStart, SessionEnd
Turn lifecycle:      UserPromptSubmit, UserPromptExpansion, Stop, StopFailure
Tool activity:       PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch
Subagents:           SubagentStart, SubagentStop, TeammateIdle
Tasks:               TaskCreated, TaskCompleted
Worktrees:           WorktreeCreate, WorktreeRemove
Compaction:          PreCompact, PostCompact
Instructions:        InstructionsLoaded
Filesystem:          FileChanged, CwdChanged
Configuration:       ConfigChange
Permissions:         PermissionRequest, PermissionDenied
MCP elicitation:     Elicitation, ElicitationResult
Notifications:       Notification
```

All hooks are fire-and-forget (graceful on failure). `SessionStart` and `PostCompact` inject project context. `PostToolUse` nudges Claude to `gcc_commit` every N tool ops (configurable). `PreToolUse` captures tool intent BEFORE execution (distinct from `PostToolUse` outcome). `FileChanged` defaults to watching dependency manifests (`flake.nix`, `package.json`, `pyproject.toml`, etc.) — auto-tag commits on dep updates. OPSEC: `ElicitationResult` records only field-count, never user-supplied form values (which may carry credentials).

## Storage

```
your-project/
└── .gcc/
    ├── state.db                # SQLite source of truth (WAL mode)
    ├── context/                # Rendered markdown views (regenerated on every write)
    │   ├── main.md             # Project focus, milestones, open branches
    │   └── branches/
    │       ├── _registry.md    # Active branch + history table
    │       ├── main/{commits.md, log.md}
    │       └── {branch}/{commits.md, log.md}
    ├── context.v2-backup/      # Pre-migration snapshot (auto-created on v2→v3)
    ├── config.json             # Optional overrides
    └── error.log               # Auto-rotated (max 100 lines)
```

**The DB is authoritative. Markdown files are disposable views** — you can delete them and they'll regenerate on the next write. But most edits are safe: the renderer only overwrites on mutation, not on read.

## Tags (v3)

Optional freeform categorization on commits. Lowercased + deduped automatically.

```
gcc_commit({
  ...
  tags: ["malware", "honeypot", "infra"]
})
```

Query them:
```bash
gcc tags                  # Frequency table
gcc search fix -t malware # FTS + tag filter
```

## Branch Templates (v3)

Scaffold the rendered branch header with work-mode-appropriate sections:

| Template | Adds these sections | Use for |
|---|---|---|
| `investigation` | **Evidence Log** | Hypothesis-driven debugging, RCA |
| `feature` | **Acceptance Criteria** | New functionality with concrete "done" |
| `incident` | **Timeline**, **Impact** | Production issues |
| `refactor` | **Scope**, **Risks** | Bounded code changes |

## Structured Merge Conclusions (v3)

Evidence-backed consolidation when findings will outlive the branch:

```
gcc_merge({
  branch_name: "investigate-latency-spike",
  outcome: "success",
  conclusion: "Root cause: connection pool saturation during deploy.",
  confidence: "high",
  evidence_files: [
    "bench/before.txt",
    "bench/after.txt",
    "grafana/latency-p99.png"
  ]
})
```

Rendered markdown shows confidence and a bulleted evidence list — audit-grade consolidation.

## Full-Text Search (v3)

SQLite FTS5 indexes every commit's `title`, `what`, `why`, and `next_step` with Porter stemming. Search syntax:

```
redis                    # stemmed (matches redis, redising)
"log rotation"           # phrase
mirai AND redtail        # boolean
auth NOT oauth           # negation
deploy*                  # prefix
```

Ranked by relevance. Optional tag and branch filters.

## Observability

- `gcc_status` and `gcc status` surface recent hook errors from `error.log` (`Hook errors (24h): N — last: TIMESTAMP`)
- `GCC_DEBUG=1` env var makes every hook emit timestamped stderr lines with event/tool/duration
- `error.log` auto-rotates at 100 lines

## Configuration

Create `.gcc/config.json` in any project (optional):

```json
{
  "recentCommitCount": 3,
  "milestonesKept": 5,
  "logMaxLines": 500,
  "nudgeAfterToolUses": 30
}
```

| Key | Default | Description |
|---|---|---|
| `recentCommitCount` | 3 | Recent commits injected at session start |
| `milestonesKept` | 5 | Milestones shown in main.md |
| `logMaxLines` | 500 | Soft cap on log retention |
| `nudgeAfterToolUses` | 30 | Tool ops between commit nudges |

Malformed config emits a stderr warning instead of silently falling back to defaults.

## Migration

- **v1 → v2**: Runs automatically when a v1 `.gcc/commits.md` at root is detected. Moves to `branches/main/`, backs up originals.
- **v2 → v3**: Runs automatically when `.gcc/state.db` is missing. Reads existing markdown, populates SQLite, backs up markdown to `context.v2-backup/`. Preserves original commit timestamps and IDs where possible.

Both migrations are idempotent and safe. Backups are never deleted automatically.

## Uninstall

```bash
cd claude-gcc
./uninstall.sh          # Remove hooks, skills, MCP server, gcc CLI symlink
./uninstall.sh --purge  # Also remove all .gcc/ directories
```

## Development

```bash
git clone https://github.com/thatainomadlife/open-gcc.git
cd claude-gcc
npm install
npm run build    # tsc + esbuild bundle MCP server
npm test         # 110+ tests, <2s
npm run dev      # Watch mode
```

See [CHANGELOG.md](CHANGELOG.md) for version history.

## The Competitive Landscape

| | GCC | OneContext | claude-mem | Context Manager |
|---|---|---|---|---|
| **Runtime deps** | **0** (uses built-in `node:sqlite`) | Cloud backend | SQLite + ChromaDB | macOS app |
| **Storage** | SQLite + rendered markdown | Their servers | Vector DB | Reads Claude's data |
| **Open source** | MIT — the whole thing | "Open source" but cloud-required | AGPL + noncommercial | Closed source ($29) |
| **Install** | `git clone && ./install.sh` | OAuth + cloud sync | Background HTTP server | `.dmg`, macOS only |
| **Works offline** | Yes, always | No | Yes (local DB) | Yes (local app) |
| **Git metaphor** | Commit/branch/merge | No | No | No workflow |
| **Full-text search** | Yes (FTS5) | Via their cloud | Vector similarity | No |
| **CLI** | Yes (`gcc`) | Web UI | No | No |
| **You own your data** | Files in your repo | Their servers | Their DB format | Their app's cache |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — the whole thing, not just the parts we want you to see.

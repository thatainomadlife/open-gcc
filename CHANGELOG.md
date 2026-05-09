# Changelog

All notable changes to GCC (Git-style Context Controller). Keep-a-Changelog format.

## [3.1.1] — 2026-04-25

Bug fix release.

### Fixed
- **MCP transport-layer array stringification** (reported by another Claude session). Some MCP clients/transports stringify array params during the JSON-RPC handoff — a native `["a","b"]` arrives server-side as the string `"[\"a\",\"b\"]"`, then Zod's `z.array(z.string())` rejects it with `expected array, received string`. Affected `gcc_commit.files_changed`, `gcc_commit.tags`, and `gcc_merge.evidence_files`. Replaced strict `z.array(z.string())` with a lenient `stringArray` union that accepts both native string arrays AND JSON-encoded array strings, transforming the latter back to a real array before downstream operations see it. Garbage inputs (non-JSON strings, non-string-array contents) still rejected with clear errors. Defense-in-depth — keeps GCC usable across all MCP client implementations regardless of transport quirks.

---

## [3.1.0] — 2026-04-25

Multi-Claude concurrent operation hardening + complete hook event coverage (15/28 → 28/28).

### Added
- **13 new hook handlers** wired to cover every documented Claude Code hook event:
  - `instructions-loaded` — track CLAUDE.md / `.claude/rules/*.md` loads (memory_type, load_reason, file_path)
  - `pre-tool-use` — log tool intent BEFORE execution (distinct from `tool-use` post-outcome)
  - `file-changed` — watch dependency manifests (default matcher: `flake.nix|flake.lock|package.json|pyproject.toml|Cargo.toml|go.mod|requirements.txt|.envrc|.env`)
  - `config-change` — log settings.json drift mid-session (catches linter-reverts-edits class of bug)
  - `permission-request`, `permission-denied` — security posture audit
  - `user-prompt-expansion` — slash command + skill invocation profiling
  - `cwd-changed` — track cross-project navigation
  - `post-tool-batch` — record parallel tool batch resolution (success/failure counts)
  - `elicitation`, `elicitation-result` — MCP form interactions (OPSEC: user_response NOT logged, only field count)
  - `teammate-idle` — agent team load imbalance detection
  - `notification` — UX event audit (permission-prompt fatigue tracking)
- **`LOG_EVENTS` extended** in `src/db/schema.ts` with 13 new event types. No schema migration needed — single `logs` table with `event` discriminator scales naturally.
- **`HookInput` interface extended** in `src/util.ts` with all new optional fields (file_path, memory_type, load_reason, change_type, config_type, permission_suggestions, expansion_type, command_name, server_name, form_schema, batch_id, idle_reason, notification_type, etc.).

### Fixed
- **CRITICAL: SQLite WAL mode never activated.** `PRAGMA journal_mode = WAL` returns a result row, but it was bundled inside a multi-statement `db.exec()` call in `SCHEMA_SQL` which silently no-ops on row-returning statements. Result: every `.gcc/state.db` ran in default rollback-journal mode → zero concurrent readers → instant "database is locked" errors when multiple Claude sessions or hooks contended for the same DB. Fix: pulled all PRAGMAs out of `SCHEMA_SQL` into a dedicated `GccDb.applyPragmas()` method using `prepare().get()` for `journal_mode` and `exec()` for the rest.
- **CRITICAL: PRAGMA application order.** `busy_timeout = 5000` was being set AFTER `journal_mode = WAL`, leaving the FIRST PRAGMA call with zero timeout protection. Under heavy write contention, journal_mode itself failed before busy_timeout could save it. Reordered so busy_timeout fires first.
- **Stress-test verified.** Before fix: 20-concurrent-writer stress test on `dark-research/.gcc/state.db` produced 9 lock errors (or instantaneous fail before the order bug was found). After both fixes: 0 lock errors under same test.
- **`session-start.ts` inner DB-failure catch** now writes to `error.log` via `logError()` instead of stderr-only — prior errors were invisible to debugging because Claude Code doesn't surface stderr.

### Changed
- **`install.sh` updated** with HOOKS_JSON entries, jq cleanup, and jq append blocks for all 13 new hook events.
- **PRAGMA configuration moved** from `SCHEMA_SQL` constant in `schema.ts` to `GccDb.applyPragmas()` method in `index.ts`. Applied per-connection BEFORE `initSchema()` runs.

### OPSEC notes
- `elicitation-result` handler intentionally records only field-count from `user_response` — never the actual filled values, since MCP forms may carry credentials, API keys, or other sensitive input.
- `user-prompt-expansion` handler caps `command_args` at 200 chars to avoid logging large prompt bodies.

---

## [3.0.0] — 2026-04-23

Major rearchitecture: SQLite storage, FTS5 search, CLI binary, and the task/worktree hook events. Still zero runtime dependencies.

### Added
- **SQLite storage** via Node 22+'s built-in `node:sqlite`. DB is source of truth; markdown files under `.gcc/context/` are rendered views regenerated on every mutation.
- **4 new hook events** wired: `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove` (15 hook events total).
- **`gcc_search` MCP tool** — SQLite FTS5 full-text search over all commits. Supports `AND`/`OR`/`NOT`/quoted phrases/prefix `*`. Optional tag and branch filters.
- **Commit tags** — optional `tags` array on `gcc_commit`. Lowercased and deduped automatically. Query via `gcc_search` with tag filter or `gcc tags` CLI.
- **Branch templates** — `gcc_branch` accepts `template`: `investigation` (Evidence Log), `feature` (Acceptance Criteria), `incident` (Timeline + Impact), `refactor` (Scope + Risks). Scaffolds the rendered branch header.
- **Structured merge conclusions** — `gcc_merge` accepts `confidence` (`high`/`medium`/`low`) and `evidence_files` (array). Rendered conclusion block shows both.
- **`gcc` CLI binary** — symlinked to `~/.local/bin/gcc` on install. Subcommands: `status`, `log`, `search`, `commits`, `tags`, `branches`, `export`, `help`. Color-aware (respects TTY), JSON + markdown export, `--gcc-root` override.
- **`GCC_DEBUG=1` env mode** — when set, every hook emits a timestamped stderr line with event, tool, and duration. Silent by default.
- **Error observability** — `gcc_status` and `gcc status` surface recent hook errors from `error.log` (`Hook errors (24h): N — last: TIMESTAMP`).
- **FTS5 index** with triggers on commits table — search index stays in sync automatically.
- **Atomic commit+log** — `db.insertCommit` writes the commit row AND a `'commit'` log entry in a single transaction, anchoring `countLogsSinceLastCommit` on log ID instead of timestamp.
- **v3 migration** (`migrate-v3.ts`) — reads existing v2 markdown state, populates SQLite, backs up markdown to `.gcc/context.v2-backup/`. Preserves original commit timestamps. Idempotent.
- **94-test concurrency regression** — 200 rapid `appendLog` calls verified zero drops. The log-rotation race that plagued v2 is dead.

### Changed
- **Minimum Node version**: 18 → 22 (for built-in `node:sqlite`).
- **Commit IDs** are now project-global monotonic (C001, C002, ...) instead of per-branch. Cross-referencing a commit ID no longer requires branch context.
- **MCP server version**: 2.1.0 → 3.0.0.
- **`stdin` read in hooks** has a 4-second timeout. Hooks no longer hang if stdin stalls.
- **Config parse failures** now emit a stderr warning instead of silently falling back to defaults.
- **Log rotation** uses the configured `maxLines` instead of a hardcoded value.
- **Post-tool-use null guards** — hooks no longer crash on tool inputs with null/undefined fields.

### Fixed
- **Log rotation race condition** (v2 critical bug): concurrent `appendLog` calls could lose entries during the truncation window. SQLite INSERT eliminates the race at the DB level.
- **Timestamp-tie race** in `countLogsSinceLastCommit`: when commit + logs shared a millisecond timestamp, counts could be off by one. Fixed by anchoring on atomic commit-log ID.
- Migration preserves original commit timestamps (was using migration-time).

### Removed
- Obsolete `tests/bootstrap.test.ts` and `tests/context.test.ts` — replaced by `tests/db.test.ts`, `tests/render.test.ts`, updated `tests/mcp/*.test.ts`, and new `tests/cli.test.ts`.

### Migration
- v1 markdown → v2 markdown: runs automatically (unchanged from v2).
- v2 markdown → v3 SQLite: runs automatically on first hook fire in any project with an existing `.gcc/`. Non-destructive — original markdown backed up.

---

## [2.2.0] — 2026-02-26

### Added
- Per-branch `.gcc/context/branches/{name}/{commits.md, log.md}` layout (v1→v2 migration).
- Branch headers with Purpose / Hypothesis / Conclusion.
- MCP tools `gcc_commit`, `gcc_branch`, `gcc_merge`, `gcc_context`, `gcc_status`.
- 11 hook events (SessionStart, SessionEnd, UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, StopFailure, PreCompact, PostCompact, SubagentStart, SubagentStop).
- Slash commands: `/gcc-commit`, `/gcc-branch`, `/gcc-merge`, `/gcc-context`, `/gcc-status`.

---

## [1.0.0]

Initial release — flat `commits.md` + `log.md` at project root.

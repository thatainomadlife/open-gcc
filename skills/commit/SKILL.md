---
name: commit
description: Record a GCC milestone. Use when completing work, fixing bugs, reaching checkpoints, or before ending a session.
argument-hint: <title>
effort: high
allowed-tools: mcp__gcc-mcp__gcc_commit
---

Record a GCC commit with title: $ARGUMENTS

## Instructions

Call the `gcc_commit` MCP tool with:

**Required fields:**
- **title**: $ARGUMENTS (derive from recent work if not provided)
- **what**: Derive from recent work context — be specific about the change
- **why**: Why it matters for the project
- **files_changed**: Key files from recent edits (at least one required)
- **next_step**: Immediate next step

**Optional fields (v3):**
- **tags**: Array of lowercase freeform tags (e.g. `["malware", "honeypot", "infra"]`) — enables topic-based search via `gcc_search` and filtering via `gcc tags` CLI. Use when the commit fits a recurring category you'll want to recall later.

All required fields are needed. Derive each from recent work context. The tool handles commit ID generation (project-global monotonic: C001, C002, ...), ISO timestamp, branch detection, main.md milestones update, atomic commit+log entry, and FTS5 index update automatically.

## Tag suggestions for Zac's workflow

- `malware`, `honeypot`, `yara`, `reverse-engineering` — security research
- `infra`, `nix`, `deploy`, `backup` — NixOS + infrastructure
- `opsec`, `tor`, `monero`, `whonix` — privacy tooling
- `docs`, `bug`, `refactor`, `migration` — engineering meta

---
name: commit
description: Record a GCC milestone. Use when completing work, fixing bugs, reaching checkpoints, or before ending a session.
argument-hint: <title>
allowed-tools: mcp__gcc-mcp__gcc_commit
---

Record a GCC commit with title: $ARGUMENTS

## Instructions

Call the `gcc_commit` MCP tool with:
- **title**: $ARGUMENTS (derive from recent work if not provided)
- **what**: Derive from recent work context — be specific about the change
- **why**: Why it matters for the project
- **files_changed**: Key files from recent edits (at least one required)
- **next_step**: Immediate next step

All fields are required. Derive each field from recent work context.

The tool handles commit ID generation, timestamp, branch detection, and updating main.md milestones automatically.

---
name: context
description: Recall GCC project state. Use PROACTIVELY at session start, after compaction, or when recalling prior work.
allowed-tools: mcp__gcc-mcp__gcc_context
---

Recall and summarize the current GCC project context.

## Instructions

Call the `gcc_context` MCP tool with:
- **level**: 1-5 (start at 2 for a good overview)
  - 1: main.md only (~200 tokens)
  - 2: + last 3 commits from active branch (~600 tokens)
  - 3: + branch header (purpose/hypothesis) (~800 tokens) — only meaningful on non-main branches; on main, level 3 = level 2
  - 4: + last 10 commits (~1500 tokens)
  - 5: + specific commit by ID or keyword search (~2000+ tokens)
- **branch** (optional): specific branch to read from
- **commit_id** (optional): specific commit to retrieve (level 5)
- **metadata_segment** (optional): search term (level 5)

Summarize the returned context concisely for the user.

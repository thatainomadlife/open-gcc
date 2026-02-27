---
name: merge
description: Merge current GCC exploration branch. Use when exploration is complete and findings should be consolidated.
allowed-tools: mcp__gcc-mcp__gcc_merge
---

Merge the current GCC exploration branch back to main.

## Instructions

Call the `gcc_merge` MCP tool with:
- **branch_name**: Name of the branch to merge (must be the currently active branch)
- **outcome**: One of: success, failure, partial
- **conclusion**: Key takeaway from the exploration

The tool handles conclusion writing, merge commit creation, registry updates, and branch list cleanup automatically.
Guard: must be on the named branch (not main).

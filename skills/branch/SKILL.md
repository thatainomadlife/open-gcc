---
name: branch
description: Create a GCC exploration branch. Use before exploring uncertain approaches, investigating bugs, or comparing alternatives.
argument-hint: <name>
allowed-tools: mcp__gcc-mcp__gcc_branch
---

Create GCC exploration branch: $ARGUMENTS

## Instructions

Call the `gcc_branch` MCP tool with:
- **name**: $ARGUMENTS (must be kebab-case: lowercase, hyphens)
- **purpose**: Describe what we're exploring and why
- **hypothesis**: What we expect to find or prove

The tool handles directory creation, registry updates, and main.md branch list automatically.
Guards: must be on main, name must not already exist.

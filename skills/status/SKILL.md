---
name: status
description: Quick GCC status check. Use to see active branch, last commit, tool count since last commit, and open branches.
effort: low
allowed-tools: mcp__gcc-mcp__gcc_status
---

Show current GCC status — active branch, last commit, recent activity.

## Instructions

Call the `gcc_status` MCP tool with no arguments.

Returns:
- Active branch name
- Last commit ID, title, and timestamp
- Time since last commit
- Tool operations since last commit
- Open branches list

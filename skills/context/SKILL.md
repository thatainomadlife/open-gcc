---
name: context
description: Recall current GCC project state — focus, milestones, open branches. Use PROACTIVELY at session start.
allowed-tools: Read
---

Recall and summarize the current GCC project context.

## Instructions

1. Read `.gcc/context/main.md` — current focus, milestones, open branches
2. Read `.gcc/context/branches/_registry.md` — active branch name
3. Read the last 5 entries from `.gcc/context/commits.md`
4. If the active branch is not `main`, also read `.gcc/context/branches/{branch-name}.md`
5. Summarize concisely:
   - **Current focus**: What we're working on
   - **Active branch**: main or exploration branch (with purpose)
   - **Recent progress**: Last 3-5 milestones
   - **Open explorations**: Any branches in progress

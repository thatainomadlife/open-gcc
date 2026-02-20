---
name: commit
description: Record a GCC milestone manually. Use when you want to name a specific checkpoint.
argument-hint: <title>
allowed-tools: Read, Edit, Bash(date *)
---

Record a GCC commit with title: $ARGUMENTS

## Instructions

1. Read `.gcc/context/commits.md` to find the latest commit ID (first `## [C###]` line)
2. Increment the ID (e.g. C001 -> C002, C042 -> C043)
3. Get current timestamp: `date '+%Y-%m-%d %H:%M'`
4. Read `.gcc/context/branches/_registry.md` for the active branch name
5. Prepend a new entry to `commits.md` (after the `# Milestone Journal` header):

```
## [C###] YYYY-MM-DD HH:MM | branch:{active} | {title}
**What**: {describe what was accomplished based on recent context}
**Why**: {why it matters for the project}
**Files**: {key files from recent edits, comma-separated}
**Next**: {immediate next step}

---

```

6. Update the `## Recent Milestones` section in `.gcc/context/main.md`:
   - Add new entry at top: `- YYYY-MM-DD: {title} ({branch})`
   - Keep only the last 5 entries
   - Remove `- (none yet)` if present

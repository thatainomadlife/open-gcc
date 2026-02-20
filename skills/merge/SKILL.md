---
name: merge
description: Merge current GCC exploration branch back to main. Consolidate findings.
allowed-tools: Read, Write, Edit, Bash(date *)
---

Merge the current GCC exploration branch back to main.

## Instructions

1. Read `.gcc/context/branches/_registry.md` for the active branch name
2. If active branch is `main`, respond: "Nothing to merge — already on main."
3. Read the branch file at `.gcc/context/branches/{branch-name}.md`
4. Fill in the `## Conclusion` section with a summary of findings
5. Update `.gcc/context/branches/_registry.md`:
   - Set `## Active Branch` back to `main`
   - Update the branch's row in Branch History: change status from `active` to `merged`
6. Auto-commit the merge:
   - Read `commits.md` for next commit ID
   - Get timestamp: `date '+%Y-%m-%d %H:%M'`
   - Prepend entry: `## [C###] YYYY-MM-DD HH:MM | branch:{name} | Merge: {branch-name}`
   - Fill What/Why/Files/Next based on branch findings
7. Update `.gcc/context/main.md`:
   - Remove the branch from `## Open Branches`
   - Add merge milestone to `## Recent Milestones` (keep last 5)
   - If no open branches remain, set to `- (none)`

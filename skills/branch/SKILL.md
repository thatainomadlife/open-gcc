---
name: branch
description: Create a GCC exploration branch for uncertain approaches or investigations.
argument-hint: <name>
allowed-tools: Read, Write, Edit, Bash(date *)
---

Create GCC exploration branch: $ARGUMENTS

## Instructions

1. Validate the branch name is kebab-case (lowercase, hyphens only)
2. Get current date: `date '+%Y-%m-%d'`
3. Create `.gcc/context/branches/$ARGUMENTS.md` with this template:

```markdown
# Branch: $ARGUMENTS

## Purpose
(Describe what we're exploring and why)

## Hypothesis
(What we expect to find or prove)

## Findings
(Fill in during exploration)

## Conclusion
(Fill in at merge time — success/failure/partial)
```

4. Update `.gcc/context/branches/_registry.md`:
   - Change `## Active Branch` line to: `$ARGUMENTS`
   - Add row to Branch History table: `| $ARGUMENTS | active | YYYY-MM-DD |`

5. Update `.gcc/context/main.md`:
   - Add `- $ARGUMENTS` to the `## Open Branches` section
   - Remove `- (none)` if present

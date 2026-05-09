---
name: merge
description: Merge current GCC exploration branch. Use when exploration is complete and findings should be consolidated.
effort: medium
allowed-tools: mcp__gcc-mcp__gcc_merge
---

Merge the current GCC exploration branch back to main.

## Instructions

Call the `gcc_merge` MCP tool with:

**Required fields:**
- **branch_name**: Name of the branch to merge (must be the currently active branch)
- **outcome**: One of: `success`, `failure`, `partial`
- **conclusion**: Key takeaway from the exploration

**Optional fields (v3, recommended for high-value work):**
- **confidence**: `high`, `medium`, or `low` — your confidence in the conclusion. Use when downstream decisions will depend on this finding.
- **evidence_files**: Array of files or artifacts supporting the conclusion (logs, benchmark outputs, screenshots, test reports). Rendered as a bulleted list in the branch conclusion block.

## When to record structured conclusions

Always record `confidence` + `evidence_files` when:
- The merge outcome will be cited in future commits or decisions
- The investigation produced reproducible artifacts (benchmarks, crash dumps, YARA hits)
- You're publishing findings externally (blog, report, abuse submission)

Skip them for quick exploratory branches that produced no artifacts.

The tool handles conclusion writing, merge commit creation on main, registry updates, branch list cleanup, and main.md milestones automatically.
Guard: must be on the named branch (not main).

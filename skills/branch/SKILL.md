---
name: branch
description: Create a GCC exploration branch. Use before exploring uncertain approaches, investigating bugs, or comparing alternatives.
argument-hint: <name>
effort: low
allowed-tools: mcp__gcc-mcp__gcc_branch
---

Create GCC exploration branch: $ARGUMENTS

## Instructions

Call the `gcc_branch` MCP tool with:

**Required fields:**
- **name**: $ARGUMENTS (must be kebab-case: lowercase, hyphens)
- **purpose**: Describe what we're exploring and why
- **hypothesis**: What we expect to find or prove

**Optional field (v3):**
- **template**: One of `investigation`, `feature`, `incident`, `refactor`. Scaffolds template-appropriate sections in the rendered branch header.

## Template reference

| Template | Adds these sections | Use when |
|----------|---------------------|----------|
| `investigation` | **Evidence Log** | Hypothesis-driven work: debugging unknown issues, root-cause analysis |
| `feature` | **Acceptance Criteria** | Building something new with concrete "done" conditions |
| `incident` | **Timeline**, **Impact** | Time-pressured production issues — capture detection → mitigation → resolution |
| `refactor` | **Scope**, **Risks** | Bounded code change with explicit boundaries and risk tracking |

The tool handles directory creation, registry updates, and main.md branch list automatically.
Guards: must be on main, name must not already exist, template must be valid if provided.

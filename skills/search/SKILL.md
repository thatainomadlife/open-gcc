---
name: search
description: Full-text search across all GCC commits. Use to recall prior work on a topic without scrolling through gcc_context. Supports FTS5 operators and optional tag/branch filters.
argument-hint: <query>
effort: low
allowed-tools: mcp__gcc-mcp__gcc_search
---

Full-text search across GCC commits: $ARGUMENTS

## Instructions

Call the `gcc_search` MCP tool with:

**Required field:**
- **query**: $ARGUMENTS — search term(s). SQLite FTS5 syntax supported.

**Optional fields:**
- **limit**: Max results (default 10)
- **tag**: Filter by commit tag (e.g., `"malware"`, `"infra"`)
- **branch**: Filter by branch name

## FTS5 query syntax

| Syntax | Example | Meaning |
|--------|---------|---------|
| `word` | `redis` | Match `redis` (stemmed — also matches `redising`) |
| `"exact phrase"` | `"log rotation"` | Phrase match |
| `A AND B` | `mirai AND redtail` | Both terms must appear |
| `A OR B` | `sqlite OR sqlite3` | Either term |
| `A NOT B` | `auth NOT oauth` | First without second |
| `prefix*` | `deploy*` | Prefix match (deploy, deployed, deploying) |

## When to use

- Recall prior decisions: "what did we conclude about X in November?"
- Cross-branch discovery: find every commit that touched a specific library
- Tag-scoped review: `{query: "fix", tag: "malware"}` — all malware-tagged bugfixes
- Pre-blog-post research: dump search results as starting material

## Complement to gcc_context

Use `gcc_search` when you have a keyword in mind. Use `gcc_context level=5 metadata_segment=...` for similar but lighter-weight single-branch lookups. Use `gcc_context level=1-4` for situational awareness without a specific query.

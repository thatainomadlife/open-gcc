#!/usr/bin/env bash
set -euo pipefail

# claude-gcc uninstaller
# Removes hooks from Claude Code settings and skill symlinks.
# Does NOT delete .gcc/ directories from projects (that's your data).
# Use --purge to also remove .gcc/ directories.

CLAUDE_DIR="${HOME}/.claude"
SETTINGS="${CLAUDE_DIR}/settings.json"
SKILLS_DIR="${CLAUDE_DIR}/skills"
PURGE=false

for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=true ;;
  esac
done

echo "=== claude-gcc uninstaller ==="

# --- Remove hooks ---
echo "[1/3] Removing hooks from Claude Code settings..."
if command -v jq &>/dev/null && [[ -f "$SETTINGS" ]]; then
  tmp=$(mktemp)
  # Match on "gcc-" or "claude-gcc" in command path — stable identifier
  jq '
    .hooks.SessionStart = [(.hooks.SessionStart // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.UserPromptSubmit = [(.hooks.UserPromptSubmit // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.PostToolUse = [(.hooks.PostToolUse // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.Stop = [(.hooks.Stop // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.PreCompact = [(.hooks.PreCompact // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))]
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "      Hooks removed."
else
  echo "      WARNING: jq not found or settings missing. Remove hooks manually."
fi

# --- Remove skills ---
echo "[2/3] Removing skill symlinks..."
for skill in commit branch merge context; do
  target="${SKILLS_DIR}/gcc-${skill}"
  if [[ -L "$target" ]]; then
    rm "$target"
    echo "      Removed /gcc-${skill}"
  fi
done

# --- Remove MCP server + permissions ---
echo "[3/3] Removing MCP server registration..."
if command -v claude &>/dev/null; then
  claude mcp remove --scope user gcc-mcp 2>/dev/null || true
  echo "      MCP server removed via claude CLI."
else
  CLAUDE_JSON="${HOME}/.claude.json"
  if command -v jq &>/dev/null && [[ -f "$CLAUDE_JSON" ]]; then
    tmp=$(mktemp)
    jq 'del(.mcpServers["gcc-mcp"])' "$CLAUDE_JSON" > "$tmp" && mv "$tmp" "$CLAUDE_JSON"
    echo "      MCP server removed via jq."
  fi
fi

# Remove tool permissions
if command -v jq &>/dev/null && [[ -f "$SETTINGS" ]]; then
  tmp=$(mktemp)
  jq '
    .permissions.allow = [(.permissions.allow // [])[] | select(startswith("mcp__gcc-mcp__") | not)]
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "      Tool permissions removed."
fi

echo ""
echo "=== claude-gcc uninstalled ==="
echo "Note: .gcc/ directories in your projects are untouched (that's your context data)."

if $PURGE; then
  echo ""
  echo "Purging .gcc/ directories..."
  read -rp "Are you sure? This deletes all GCC context data. [y/N] " confirm
  if [[ "${confirm,,}" == "y" ]]; then
    find "${HOME}" -maxdepth 6 -name '.gcc' -type d -exec rm -rf {} + 2>/dev/null || true
    echo "Purged."
  else
    echo "Skipped."
  fi
else
  echo "Delete them manually if you want: find ~/dev -name '.gcc' -type d"
  echo "Or re-run with --purge to remove them."
fi

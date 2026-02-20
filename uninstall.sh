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
echo "[1/2] Removing hooks from Claude Code settings..."
if command -v jq &>/dev/null && [[ -f "$SETTINGS" ]]; then
  tmp=$(mktemp)
  # Match on "gcc-" in command path — stable identifier regardless of install location
  jq '
    .hooks.SessionStart = [(.hooks.SessionStart // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.PostToolUse = [(.hooks.PostToolUse // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.Stop = [(.hooks.Stop // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
    .hooks.PreCompact = [(.hooks.PreCompact // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))]
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"

  # Clean up any GCC-injected env vars
  tmp2=$(mktemp)
  jq 'if .env then .env |= del(.OPENAI_API_KEY // empty) else . end' "$SETTINGS" > "$tmp2" && mv "$tmp2" "$SETTINGS"

  echo "      Hooks removed."
else
  echo "      WARNING: jq not found or settings missing. Remove hooks manually."
fi

# --- Remove skills ---
echo "[2/2] Removing skill symlinks..."
for skill in commit branch merge context; do
  target="${SKILLS_DIR}/gcc-${skill}"
  if [[ -L "$target" ]]; then
    rm "$target"
    echo "      Removed /gcc-${skill}"
  fi
done

echo ""
echo "=== claude-gcc uninstalled ==="
echo "Note: .gcc/ directories in your projects are untouched (that's your context data)."

if $PURGE; then
  echo ""
  echo "Purging .gcc/ directories..."
  read -rp "Are you sure? This deletes all GCC context data. [y/N] " confirm
  if [[ "${confirm,,}" == "y" ]]; then
    find "${HOME}" -maxdepth 4 -name '.gcc' -type d -exec rm -rf {} + 2>/dev/null || true
    echo "Purged."
  else
    echo "Skipped."
  fi
else
  echo "Delete them manually if you want: find ~/dev -name '.gcc' -type d"
  echo "Or re-run with --purge to remove them."
fi

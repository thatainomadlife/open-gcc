#!/usr/bin/env bash
set -euo pipefail

# claude-gcc v2 installer
# Builds, wires hooks into Claude Code, symlinks skills.
# v2: No LLM provider needed — agent uses MCP tools directly.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${HOME}/.claude"
SETTINGS="${CLAUDE_DIR}/settings.json"
SKILLS_DIR="${CLAUDE_DIR}/skills"

echo "=== claude-gcc v2 installer ==="

# --- Prerequisites ---
echo "Checking prerequisites..."
missing=""
if ! command -v node &>/dev/null; then
  missing="${missing}  - node (>=18) — https://nodejs.org\n"
elif [[ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 18 ]]; then
  missing="${missing}  - node >=18 (found $(node -v)) — https://nodejs.org\n"
fi
if ! command -v npm &>/dev/null; then
  missing="${missing}  - npm — https://nodejs.org\n"
fi
if ! command -v jq &>/dev/null; then
  missing="${missing}  - jq — https://jqlang.github.io/jq/\n"
fi
if [[ -n "$missing" ]]; then
  echo "ERROR: Missing required tools:"
  echo -e "$missing"
  exit 1
fi
echo "      All prerequisites found."

# --- 1. Build ---
echo "[1/3] Building..."
cd "$SCRIPT_DIR"
npm install --silent || { echo "ERROR: npm install failed"; exit 1; }
npm run build 2>&1 || { echo "ERROR: Build failed"; exit 1; }
echo "      Built successfully."

# --- 2. Wire hooks and skills ---
echo "[2/3] Installing hooks and skills..."

if [[ ! -f "$SETTINGS" ]]; then
  echo "      Creating ${SETTINGS}..."
  mkdir -p "$CLAUDE_DIR"
  echo '{}' > "$SETTINGS"
fi

DIST_DIR="${SCRIPT_DIR}/dist"

# Build the hooks JSON to merge
HOOKS_JSON=$(cat <<ENDJSON
{
  "SessionStart": [
    {
      "matcher": "startup|resume|compact",
      "hooks": [
        {
          "type": "command",
          "command": "node ${DIST_DIR}/hooks/session-start.js",
          "timeout": 5
        }
      ]
    }
  ],
  "UserPromptSubmit": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node ${DIST_DIR}/hooks/user-prompt-submit.js",
          "timeout": 3
        }
      ]
    }
  ],
  "PostToolUse": [
    {
      "matcher": "Edit|Write|NotebookEdit|Bash",
      "hooks": [
        {
          "type": "command",
          "command": "node ${DIST_DIR}/hooks/post-tool-use.js",
          "timeout": 5
        }
      ]
    }
  ],
  "PreCompact": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node ${DIST_DIR}/hooks/pre-compact.js",
          "timeout": 10
        }
      ]
    }
  ],
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node ${DIST_DIR}/hooks/stop.js",
          "timeout": 10
        }
      ]
    }
  ]
}
ENDJSON
)

# First remove any existing GCC hooks, then append new ones.
# This preserves user's other hooks on the same events.
tmp=$(mktemp)
jq --argjson gcc_hooks "$HOOKS_JSON" '
  .hooks = (.hooks // {}) |

  # Remove existing GCC hooks (identified by "gcc" in the command path)
  .hooks.SessionStart = [(.hooks.SessionStart // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
  .hooks.UserPromptSubmit = [(.hooks.UserPromptSubmit // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
  .hooks.PostToolUse = [(.hooks.PostToolUse // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
  .hooks.Stop = [(.hooks.Stop // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
  .hooks.PreCompact = [(.hooks.PreCompact // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |

  # Append GCC hooks
  .hooks.SessionStart = (.hooks.SessionStart + $gcc_hooks.SessionStart | unique_by(.matcher // "")) |
  .hooks.UserPromptSubmit = (.hooks.UserPromptSubmit + $gcc_hooks.UserPromptSubmit | unique_by(.hooks[0].command)) |
  .hooks.PostToolUse = (.hooks.PostToolUse + $gcc_hooks.PostToolUse | unique_by(.matcher // "")) |
  .hooks.Stop = (.hooks.Stop + $gcc_hooks.Stop | unique_by(.hooks[0].command)) |
  .hooks.PreCompact = (.hooks.PreCompact + $gcc_hooks.PreCompact | unique_by(.hooks[0].command))
' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
echo "      Hooks installed."

# --- Symlink skills ---
echo "      Installing skills..."
mkdir -p "$SKILLS_DIR"

for skill in commit branch merge context; do
  target="${SKILLS_DIR}/gcc-${skill}"
  source="${SCRIPT_DIR}/skills/${skill}"
  if [[ -L "$target" || -d "$target" ]]; then
    rm -rf "$target"
  fi
  ln -s "$source" "$target"
  echo "      /gcc-${skill} -> ${source}"
done

# --- 3. Register MCP server + permissions ---
echo "[3/3] Registering MCP server..."

MCP_SERVER_PATH="${DIST_DIR}/mcp/server.js"
GCC_TOOLS='["mcp__gcc-mcp__gcc_commit","mcp__gcc-mcp__gcc_branch","mcp__gcc-mcp__gcc_merge","mcp__gcc-mcp__gcc_context"]'

if command -v claude &>/dev/null; then
  # Use claude CLI to register MCP server
  claude mcp add --scope user gcc-mcp -- node "$MCP_SERVER_PATH" 2>/dev/null || true
  echo "      MCP server registered via claude CLI."
else
  # Fall back to jq-based registration in ~/.claude.json
  CLAUDE_JSON="${HOME}/.claude.json"
  if [[ ! -f "$CLAUDE_JSON" ]]; then
    echo '{}' > "$CLAUDE_JSON"
  fi
  tmp=$(mktemp)
  jq --arg path "$MCP_SERVER_PATH" '
    .mcpServers["gcc-mcp"] = {"command":"node","args":[$path]}
  ' "$CLAUDE_JSON" > "$tmp" && mv "$tmp" "$CLAUDE_JSON"
  echo "      MCP server registered via jq (claude CLI not found)."
fi

# Add tool permissions to settings
tmp=$(mktemp)
jq --argjson tools "$GCC_TOOLS" '
  .permissions = (.permissions // {}) |
  .permissions.allow = ((.permissions.allow // []) + $tools | unique)
' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
echo "      Tool permissions added."

echo ""
echo "=== claude-gcc v2 installed ==="
echo ""
echo "GCC will auto-activate in every project on next Claude Code session."
echo "Context is stored in .gcc/context/ (auto-created, auto-gitignored)."
echo ""
echo "MCP Tools (agent uses autonomously):"
echo "  gcc_commit   — Record a milestone"
echo "  gcc_branch   — Create exploration branch"
echo "  gcc_merge    — Merge branch back to main"
echo "  gcc_context  — Recall project state"
echo ""
echo "Skills (user convenience):"
echo "  /gcc-commit <title>  — Trigger manual commit"
echo "  /gcc-branch <name>   — Create branch"
echo "  /gcc-merge           — Merge branch"
echo "  /gcc-context         — Recall state"

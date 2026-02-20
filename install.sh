#!/usr/bin/env bash
set -euo pipefail

# claude-gcc installer
# Clones (if needed), builds, wires hooks into Claude Code, symlinks skills.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${HOME}/.claude"
SETTINGS="${CLAUDE_DIR}/settings.json"
SKILLS_DIR="${CLAUDE_DIR}/skills"

echo "=== claude-gcc installer ==="

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
npm run build 2>&1 || { echo "ERROR: TypeScript build failed"; exit 1; }
echo "      Built successfully."

# --- 2. Check LLM provider ---
echo "[2/3] Checking LLM provider..."
PROVIDER_FOUND=""
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  PROVIDER_FOUND="openai"
  echo "      Found OPENAI_API_KEY -> OpenAI (gpt-4.1-nano)"
elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  PROVIDER_FOUND="anthropic"
  echo "      Found ANTHROPIC_API_KEY -> Anthropic (claude-haiku-4-5)"
elif [[ -n "${GCC_OLLAMA_URL:-}" ]]; then
  PROVIDER_FOUND="ollama"
  echo "      Found GCC_OLLAMA_URL -> Ollama (llama3.2)"
fi

if [[ -z "$PROVIDER_FOUND" ]]; then
  echo ""
  echo "      WARNING: No LLM provider detected."
  echo "      Auto-extraction will be disabled. Manual /gcc-commit still works."
  echo ""
  echo "      To enable auto-extraction, set one of:"
  echo "        export OPENAI_API_KEY=sk-..."
  echo "        export ANTHROPIC_API_KEY=sk-ant-..."
  echo "        export GCC_OLLAMA_URL=http://localhost:11434"
  echo ""
fi

# --- 3. Wire hooks and skills ---
echo "[3/3] Installing hooks and skills..."

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
  "PostToolUse": [
    {
      "matcher": "Edit|Write|NotebookEdit",
      "hooks": [
        {
          "type": "command",
          "command": "node ${DIST_DIR}/hooks/post-tool-use.js",
          "timeout": 5
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
          "timeout": 30
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
          "timeout": 30
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
  .hooks.PostToolUse = [(.hooks.PostToolUse // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
  .hooks.Stop = [(.hooks.Stop // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |
  .hooks.PreCompact = [(.hooks.PreCompact // [])[] | select(.hooks | all(.command | test("gcc-|claude-gcc") | not))] |

  # Append GCC hooks
  .hooks.SessionStart = (.hooks.SessionStart + $gcc_hooks.SessionStart | unique_by(.matcher // "")) |
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

echo ""
echo "=== claude-gcc installed ==="
echo ""
echo "GCC will auto-activate in every project on next Claude Code session."
echo "Context is stored in .gcc/context/ (auto-created, auto-gitignored)."
echo ""
echo "Skills available:"
echo "  /gcc-commit <title>  — Record a named milestone"
echo "  /gcc-branch <name>   — Start an exploration branch"
echo "  /gcc-merge           — Merge branch back to main"
echo "  /gcc-context         — Recall project state"

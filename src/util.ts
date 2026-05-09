/**
 * Shared utilities for GCC hooks and modules.
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Standard hook input fields from Claude Code stdin. */
export interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  // SessionStart
  source?: string;
  // PostToolUse / PreToolUse
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  tool_use_id?: string;
  // Stop
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  // PreCompact
  trigger?: string;
  // UserPromptSubmit
  user_prompt?: string;
  // SubagentStart / SubagentStop / TeammateIdle
  agent_id?: string;
  agent_type?: string;
  agent_name?: string;
  agent_description?: string;
  idle_reason?: string;
  // InstructionsLoaded
  file_path?: string;
  memory_type?: string;
  load_reason?: string;
  globs?: string[];
  trigger_file_path?: string;
  parent_file_path?: string;
  // FileChanged
  change_type?: string;
  // ConfigChange
  config_type?: string;
  changed_fields?: string[];
  // PermissionRequest / PermissionDenied
  permission_suggestions?: unknown[];
  auto_deny_reason?: string;
  // UserPromptExpansion
  expansion_type?: string;
  command_name?: string;
  command_args?: string;
  prompt?: string;
  // CwdChanged
  old_cwd?: string;
  // Elicitation / ElicitationResult
  server_name?: string;
  form_schema?: Record<string, unknown>;
  user_response?: Record<string, unknown>;
  // PostToolBatch
  batch_id?: string;
  tool_calls?: unknown[];
  tool_responses?: unknown[];
  // Notification
  notification_type?: string;
  message?: string;
}

/**
 * Get the GCC context root for a project.
 * Uses CLAUDE_PROJECT_DIR env var, falls back to cwd.
 * Returns path to `.gcc/context/`.
 */
export function getContextRoot(cwd: string): string {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || cwd;
  return join(resolve(projectDir), '.gcc', 'context');
}

/**
 * Get the GCC root (`.gcc/`) for a project.
 */
export function getGCCRoot(cwd: string): string {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || cwd;
  return join(resolve(projectDir), '.gcc');
}

/**
 * Check if GCC is enabled — `.gcc/` directory exists.
 */
export function isGCCEnabled(cwd: string): boolean {
  return existsSync(getGCCRoot(cwd));
}

/**
 * Ensure `.gcc/` exists in the project root. Creates it if missing.
 * Also adds `.gcc/` to `.gitignore` if the project is a git repo.
 * Returns the GCC root path.
 */
export function ensureGCCRoot(cwd: string): string {
  const gccRoot = getGCCRoot(cwd);
  if (!existsSync(gccRoot)) {
    mkdirSync(gccRoot, { recursive: true });
    addToGitignore(cwd);
  }
  return gccRoot;
}

/**
 * Add `.gcc/` to `.gitignore` if this is a git repo and it's not already there.
 */
function addToGitignore(cwd: string): void {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || cwd;
    const gitDir = join(resolve(projectDir), '.git');
    if (!existsSync(gitDir)) return;

    const gitignorePath = join(resolve(projectDir), '.gitignore');
    const existing = existsSync(gitignorePath)
      ? readFileSync(gitignorePath, 'utf-8')
      : '';

    if (existing.match(/^\.gcc\/?$/m)) return;

    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    appendFileSync(gitignorePath, `${prefix}.gcc/\n`, 'utf-8');
  } catch {
    // Non-critical — don't block on gitignore failure
  }
}

/**
 * Log an error to .gcc/error.log. Non-blocking, never throws.
 * Auto-rotates at 100 lines.
 */
export function logError(gccRoot: string, error: unknown): void {
  try {
    const logPath = join(gccRoot, 'error.log');
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const message = error instanceof Error ? error.message : String(error);
    const line = `[${timestamp}] ${message}\n`;

    appendFileSync(logPath, line, 'utf-8');

    // Rotate at 100 lines
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > 100) {
      writeFileSync(logPath, lines.slice(-50).join('\n'), 'utf-8');
    }
  } catch {
    // Fire-and-forget — logging errors shouldn't cause more errors
  }
}

/**
 * Read JSON from stdin (hooks receive input this way).
 * Enforces a 4-second timeout so hooks never hang if stdin stalls.
 */
export async function readStdin(timeoutMs: number = 4000): Promise<HookInput> {
  return new Promise((resolve, reject) => {
    let data = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`stdin read timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const finish = (err: Error | null, result?: HookInput): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err) reject(err); else resolve(result!);
    };
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try { finish(null, JSON.parse(data) as HookInput); }
      catch (e) { finish(new Error(`Failed to parse stdin: ${e}`)); }
    });
    process.stdin.on('error', (e) => finish(e));
  });
}

/**
 * Write JSON output to stdout for Claude Code.
 */
export function output(data: object): void {
  process.stdout.write(JSON.stringify(data));
}

/**
 * Debug log to stderr — only emits when GCC_DEBUG=1 is set.
 * Use for troubleshooting hook timing and payloads without polluting stdout.
 */
export function debugLog(label: string, payload?: Record<string, unknown>): void {
  if (process.env.GCC_DEBUG !== '1') return;
  const ts = new Date().toISOString().slice(11, 23);
  const pid = process.pid;
  const extra = payload ? ` ${JSON.stringify(payload)}` : '';
  process.stderr.write(`[gcc-debug ${ts} pid=${pid}] ${label}${extra}\n`);
}

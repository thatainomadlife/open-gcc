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
 * Check cooldown: returns true if last commit was less than `seconds` ago.
 */
export function isOnCooldown(contextRoot: string, seconds: number = 120): boolean {
  try {
    const commitsPath = join(contextRoot, 'commits.md');
    if (!existsSync(commitsPath)) return false;

    const commits = readFileSync(commitsPath, 'utf-8');
    const match = commits.match(/## \[C\d+\] (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
    if (!match) return false;

    const lastTime = new Date(match[1].replace(' ', 'T') + ':00');
    return (Date.now() - lastTime.getTime()) / 1000 < seconds;
  } catch {
    return false;
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
 */
export async function readStdin(): Promise<HookInput> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Failed to parse stdin: ${e}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Write JSON output to stdout for Claude Code.
 */
export function output(data: object): void {
  process.stdout.write(JSON.stringify(data));
}

/**
 * GCC Milestone Extractor.
 *
 * Reads the conversation transcript JSONL, calls an LLM provider
 * to extract a structured milestone, and writes it to commits.md.
 *
 * Never throws — failures are silent to avoid blocking Claude.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig, complete } from './provider.js';
import { loadConfig } from './config.js';
import { isOnCooldown } from './util.js';
import {
  getNextCommitId,
  getActiveBranch,
  prependCommit,
  updateMainMilestones,
} from './context.js';

const EXTRACTION_PROMPT = `\
You are a milestone extraction assistant for a software project. Review this conversation \
and extract what was done. This runs after file edits — your job is to RECORD the work, \
not judge its importance. Every edit matters for project continuity.

Format your response as a structured milestone:
Title: <short title, 5-10 words>
What: <what was accomplished, 1-2 sentences>
Why: <why it matters, 1 sentence>
Files: <key files touched, comma-separated paths>
Next: <immediate next step, 1 sentence>

Rules:
- ALWAYS extract a milestone if files were edited (the system only calls you after edits)
- Be concise — each field should be one line
- Only respond with "Nothing to commit." if the conversation contains zero file edits`;

interface TranscriptMessage {
  role?: string;
  type?: string;
  content?: string | Array<{ type: string; text?: string }>;
  message?: { role?: string; content?: unknown };
}

/**
 * Extract milestones from the transcript and commit to GCC context.
 * Returns true if a commit was created, false otherwise.
 */
export async function extractAndCommit(
  contextRoot: string,
  transcriptPath: string,
  gccRoot?: string
): Promise<boolean> {
  try {
    // Load config
    const cfg = loadConfig(gccRoot ?? join(contextRoot, '..'));

    // Respect autoExtract setting
    if (!cfg.autoExtract) return false;

    // Cooldown check
    if (isOnCooldown(contextRoot, cfg.cooldownSeconds)) return false;

    // Resolve LLM provider — pass config file values so they're used as fallbacks
    const config = resolveConfig(cfg.provider || undefined, cfg.model || undefined);
    if (!config) {
      process.stderr.write('GCC: No LLM provider configured, skipping auto-extraction\n');
      return false;
    }

    // Read transcript
    const conversationText = await readTranscript(transcriptPath, cfg.maxMessages, cfg.maxMessageLength);
    if (!conversationText) return false;

    // Call LLM
    const extracted = await complete(config, {
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: conversationText },
      ],
      maxTokens: 512,
      temperature: 0,
    });

    if (!extracted || extracted.toLowerCase().startsWith('nothing to commit')) return false;

    // Parse structured fields
    const title = extracted.match(/Title:\s*(.+)/)?.[1]?.trim() || 'Auto-extracted milestone';
    const what = extracted.match(/What:\s*(.+)/)?.[1]?.trim() || extracted.slice(0, 200);
    const why = extracted.match(/Why:\s*(.+)/)?.[1]?.trim() || 'Auto-saved before context compaction';
    const files = extracted.match(/Files:\s*(.+)/)?.[1]?.trim() || '';
    const next = extracted.match(/Next:\s*(.+)/)?.[1]?.trim() || '';

    // Get commit metadata
    const commitId = getNextCommitId(contextRoot);
    const branch = getActiveBranch(contextRoot);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Build and write commit entry
    const entry = `## [${commitId}] ${timestamp} | branch:${branch} | ${title}
**What**: ${what}
**Why**: ${why}
**Files**: ${files}
**Next**: ${next}

---

`;

    await prependCommit(contextRoot, entry);
    await updateMainMilestones(contextRoot, timestamp.slice(0, 10), branch, title, cfg.milestonesKept);

    return true;
  } catch (e) {
    process.stderr.write(`GCC extraction error: ${e}\n`);
    return false;
  }
}

/**
 * Read the transcript JSONL and extract last 30 non-system messages
 * into a readable conversation summary.
 */
async function readTranscript(
  transcriptPath: string,
  maxMessages: number = 30,
  maxMessageLength: number = 1000,
): Promise<string | null> {
  try {
    if (!existsSync(transcriptPath)) return null;

    const raw = await readFile(transcriptPath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);

    const messages: Array<{ role: string; text: string }> = [];

    for (const line of lines) {
      try {
        const entry: TranscriptMessage = JSON.parse(line);

        const role = entry.role || entry.message?.role;
        if (!role || role === 'system') continue;

        let text = '';
        const content = entry.content || entry.message?.content;
        if (typeof content === 'string') {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter((c) => c.type === 'text' && c.text)
            .map((c) => c.text!)
            .join('\n');
        }

        if (text.trim()) {
          messages.push({ role, text: text.slice(0, maxMessageLength) });
        }
      } catch {
        // Skip malformed lines
      }
    }

    const recent = messages.slice(-maxMessages);
    if (recent.length === 0) return null;

    return recent.map((m) => `[${m.role}]: ${m.text}`).join('\n\n');
  } catch {
    return null;
  }
}

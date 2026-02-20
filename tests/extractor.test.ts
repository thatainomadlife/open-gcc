import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractAndCommit } from '../src/extractor.js';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('extractAndCommit', () => {
  const originalEnv = process.env;
  let gccRoot: string;
  let contextRoot: string;
  let transcriptPath: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GCC_PROVIDER;
    delete process.env.GCC_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GCC_OLLAMA_URL;
    delete process.env.GCC_AUTO_EXTRACT;

    gccRoot = join(tmpdir(), `gcc-ext-${Date.now()}`);
    contextRoot = join(gccRoot, 'context');
    mkdirSync(join(contextRoot, 'branches'), { recursive: true });
    writeFileSync(join(contextRoot, 'main.md'),
      '# Project\n\n## Current Focus\nTest\n\n## Recent Milestones\n- (none yet)\n\n## Open Branches\n- (none)\n');
    writeFileSync(join(contextRoot, 'commits.md'), '# Milestone Journal\n\n');
    writeFileSync(join(contextRoot, 'branches', '_registry.md'),
      '## Active Branch\nmain\n\n## Branch History\n');

    transcriptPath = join(tmpdir(), `transcript-${Date.now()}.jsonl`);
    writeFileSync(transcriptPath, [
      JSON.stringify({ role: 'user', content: 'Fix the login bug' }),
      JSON.stringify({ role: 'assistant', content: 'I will fix the login bug in auth.ts' }),
    ].join('\n'));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    rmSync(gccRoot, { recursive: true, force: true });
    try { rmSync(transcriptPath, { force: true }); } catch { /* */ }
  });

  it('returns false when no provider configured', async () => {
    const result = await extractAndCommit(contextRoot, transcriptPath, gccRoot);
    expect(result).toBe(false);
  });

  it('returns false when autoExtract is disabled', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GCC_AUTO_EXTRACT = 'false';
    const result = await extractAndCommit(contextRoot, transcriptPath, gccRoot);
    expect(result).toBe(false);
  });

  it('returns false on cooldown', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    // Write a recent commit
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    writeFileSync(join(contextRoot, 'commits.md'),
      `# Milestone Journal\n\n## [C001] ${now} | branch:main | Recent\n**What**: test\n`);

    const result = await extractAndCommit(contextRoot, transcriptPath, gccRoot);
    expect(result).toBe(false);
  });

  it('writes commit on successful extraction', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Title: Fixed login bug\nWhat: Fixed auth validation\nWhy: Users could not log in\nFiles: src/auth.ts\nNext: Add tests',
          },
        }],
      }),
    } as Response);

    const result = await extractAndCommit(contextRoot, transcriptPath, gccRoot);
    expect(result).toBe(true);

    const commits = readFileSync(join(contextRoot, 'commits.md'), 'utf-8');
    expect(commits).toContain('[C001]');
    expect(commits).toContain('Fixed login bug');
    expect(commits).toContain('Fixed auth validation');
  });

  it('returns false when LLM says nothing to commit', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: 'Nothing to commit.' },
        }],
      }),
    } as Response);

    const result = await extractAndCommit(contextRoot, transcriptPath, gccRoot);
    expect(result).toBe(false);
  });

  it('returns false when transcript is empty', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    writeFileSync(transcriptPath, '');
    const result = await extractAndCommit(contextRoot, transcriptPath, gccRoot);
    expect(result).toBe(false);
  });

  it('updates main.md milestones', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Title: Added dark mode\nWhat: Implemented dark theme\nWhy: User requested\nFiles: theme.css\nNext: Test',
          },
        }],
      }),
    } as Response);

    await extractAndCommit(contextRoot, transcriptPath, gccRoot);

    const main = readFileSync(join(contextRoot, 'main.md'), 'utf-8');
    expect(main).toContain('Added dark mode');
    expect(main).not.toContain('(none yet)');
  });
});

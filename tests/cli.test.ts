import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { handleCommit } from '../src/mcp/operations/commit.js';
import { handleBranch } from '../src/mcp/operations/branch.js';
import { makeFixture, type Fixture } from './helpers.js';

const CLI = resolve('dist/cli/index.js');

function runCli(args: string[], env: Record<string, string> = {}): string {
  return execFileSync('node', ['--no-warnings=ExperimentalWarning', CLI, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...env, NO_COLOR: '1' },
  });
}

describe('gcc CLI', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = makeFixture();
    f.db.close();
    await handleCommit(f.contextRoot, {
      title: 'First commit', what: 'Did a thing', why: 'Reason',
      files_changed: ['a.ts'], next_step: 'Next',
      tags: ['infra'],
    });
    await handleCommit(f.contextRoot, {
      title: 'Second commit about redis', what: 'Redis timeout fix', why: 'Stability',
      files_changed: ['redis.ts'], next_step: 'Monitor',
      tags: ['infra', 'redis'],
    });
  });
  afterEach(() => { f.cleanup(); });

  it('status shows summary', () => {
    const out = runCli(['status', '--gcc-root', f.gccRoot]);
    expect(out).toContain('GCC Status');
    expect(out).toContain('Active branch');
    expect(out).toContain('main');
    expect(out).toContain('C002');
    expect(out).toContain('Total commits:  2');
  });

  it('commits lists recent commits', () => {
    const out = runCli(['commits', '--gcc-root', f.gccRoot]);
    expect(out).toContain('C001');
    expect(out).toContain('C002');
    expect(out).toContain('Second commit about redis');
  });

  it('commits -v shows verbose output', () => {
    const out = runCli(['commits', '--gcc-root', f.gccRoot, '-v']);
    expect(out).toContain('What:');
    expect(out).toContain('Why:');
    expect(out).toContain('Tags:');
  });

  it('search finds commits by term', () => {
    const out = runCli(['search', 'redis', '--gcc-root', f.gccRoot]);
    expect(out).toContain('Second commit about redis');
    expect(out).not.toContain('First commit');
  });

  it('search with no match prints helpful message', () => {
    const out = runCli(['search', 'xyzzynothing', '--gcc-root', f.gccRoot]);
    expect(out).toContain('no matches');
  });

  it('tags lists frequencies', () => {
    const out = runCli(['tags', '--gcc-root', f.gccRoot]);
    expect(out).toContain('infra');
    expect(out).toContain('redis');
  });

  it('branches shows main + open branches', async () => {
    await handleBranch(f.contextRoot, { name: 'explore-x', purpose: 'p', hypothesis: 'h' });
    const out = runCli(['branches', '--gcc-root', f.gccRoot]);
    expect(out).toContain('main');
    expect(out).toContain('explore-x');
  });

  it('export --format json returns valid JSON', () => {
    const out = runCli(['export', '--format', 'json', '--gcc-root', f.gccRoot]);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toHaveProperty('commit_id');
    expect(parsed[0]).toHaveProperty('title');
  });

  it('export --format markdown returns markdown', () => {
    const out = runCli(['export', '--gcc-root', f.gccRoot]);
    expect(out).toContain('# Commits from branch:main');
    expect(out).toContain('**What**:');
  });

  it('help prints usage', () => {
    const out = runCli(['help']);
    expect(out).toContain('SUBCOMMANDS:');
    expect(out).toContain('status');
    expect(out).toContain('search');
  });

  it('surfaces error.log in status when recent errors exist', () => {
    const errPath = join(f.gccRoot, 'error.log');
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    writeFileSync(errPath, `[${now}] something broke\n`);
    const out = runCli(['status', '--gcc-root', f.gccRoot]);
    expect(out).toContain('Hook errors (24h)');
  });

  it('unknown subcommand exits with code 2', () => {
    expect(() => runCli(['bogus-sub'])).toThrow();
  });
});

describe('GCC_DEBUG mode', () => {
  it('emits stderr debug line when GCC_DEBUG=1', async () => {
    const { spawnSync } = await import('node:child_process');
    const { mkdirSync, rmSync } = await import('node:fs');
    const projectDir = join('/tmp', `gcc-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const gccDir = join(projectDir, '.gcc');
    mkdirSync(gccDir, { recursive: true });
    try {
      const session = JSON.stringify({ cwd: projectDir, session_id: 's', transcript_path: '', permission_mode: 'default', hook_event_name: 'Stop' });
      const result = spawnSync('node', ['--no-warnings=ExperimentalWarning', 'dist/hooks/stop.js'], {
        input: session,
        encoding: 'utf-8',
        env: { ...process.env, GCC_DEBUG: '1', CLAUDE_PROJECT_DIR: projectDir },
      });
      expect(result.stderr).toContain('[gcc-debug');
      expect(result.stderr).toContain('event=stop');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('silent by default (no GCC_DEBUG)', async () => {
    const { spawnSync } = await import('node:child_process');
    const { mkdirSync, rmSync } = await import('node:fs');
    const projectDir = join('/tmp', `gcc-nodebug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const gccDir = join(projectDir, '.gcc');
    mkdirSync(gccDir, { recursive: true });
    try {
      const session = JSON.stringify({ cwd: projectDir, session_id: 's', transcript_path: '', permission_mode: 'default', hook_event_name: 'Stop' });
      const result = spawnSync('node', ['--no-warnings=ExperimentalWarning', 'dist/hooks/stop.js'], {
        input: session,
        encoding: 'utf-8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, GCC_DEBUG: '' },
      });
      expect(result.stderr).not.toContain('[gcc-debug');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

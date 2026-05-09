import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleSearch } from '../../src/mcp/operations/search.js';
import { handleCommit } from '../../src/mcp/operations/commit.js';
import { handleBranch } from '../../src/mcp/operations/branch.js';
import { makeFixture, type Fixture } from '../helpers.js';

describe('handleSearch', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = makeFixture();
    f.db.close();
    await handleCommit(f.contextRoot, {
      title: 'Fixed redis timeout', what: 'Bumped connect timeout to 10s', why: 'Prod stability',
      files_changed: ['config/redis.ts'], next_step: 'Monitor for a week',
      tags: ['infra', 'redis'],
    });
    await handleCommit(f.contextRoot, {
      title: 'Honeypot malware triage', what: 'Classified 12 new Mirai variants', why: 'Threat intel feed',
      files_changed: ['yara/mirai.yar'], next_step: 'Submit to MalwareBazaar',
      tags: ['malware', 'honeypot'],
    });
    await handleCommit(f.contextRoot, {
      title: 'Refactored auth middleware', what: 'Extracted JWT validation to shared helper', why: 'Reuse',
      files_changed: ['src/auth.ts'], next_step: 'Add tests',
      tags: ['refactor'],
    });
  });
  afterEach(() => { f.cleanup(); });

  it('finds commits by term', async () => {
    const result = await handleSearch(f.contextRoot, { query: 'redis' });
    expect(result).toContain('redis timeout');
    expect(result).not.toContain('malware');
  });

  it('supports AND search', async () => {
    const result = await handleSearch(f.contextRoot, { query: 'malware AND mirai' });
    expect(result).toContain('Honeypot malware triage');
  });

  it('returns helpful message when no matches', async () => {
    const result = await handleSearch(f.contextRoot, { query: 'xyzzynotathing' });
    expect(result).toContain('No commits match');
  });

  it('rejects empty query', async () => {
    const result = await handleSearch(f.contextRoot, { query: '' });
    expect(result).toContain('Error');
  });

  it('filters by tag', async () => {
    const result = await handleSearch(f.contextRoot, { query: 'mirai', tag: 'malware' });
    expect(result).toContain('Honeypot');
    expect(result).not.toContain('redis timeout');
  });

  it('filters by branch', async () => {
    await handleBranch(f.contextRoot, { name: 'explore-x', purpose: 'p', hypothesis: 'h' });
    await handleCommit(f.contextRoot, {
      title: 'Branch work on caching', what: 'Tried memcached', why: 'benchmark',
      files_changed: ['x'], next_step: 'keep going',
    });
    const result = await handleSearch(f.contextRoot, { query: 'caching', branch: 'explore-x' });
    expect(result).toContain('Branch work on caching');
  });

  it('respects limit', async () => {
    const result = await handleSearch(f.contextRoot, { query: 'a OR i OR o', limit: 1 });
    // Count commit headers (## [Cxxx])
    const matches = result.match(/## \[C\d+\]/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});

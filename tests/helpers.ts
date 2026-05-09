/**
 * Shared test helpers for GCC v3 tests.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, type GccDb } from '../src/db/index.js';
import { renderAll } from '../src/db/render.js';

export interface Fixture {
  gccRoot: string;
  contextRoot: string;
  db: GccDb;
  cleanup: () => void;
}

export function makeFixture(): Fixture {
  const gccRoot = join(tmpdir(), `gcc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const contextRoot = join(gccRoot, 'context');
  mkdirSync(gccRoot, { recursive: true });
  const db = openDb(gccRoot);
  return {
    gccRoot,
    contextRoot,
    db,
    cleanup: () => {
      try { db.close(); } catch { /* already closed */ }
      rmSync(gccRoot, { recursive: true, force: true });
    },
  };
}

export async function renderFixture(f: Fixture): Promise<void> {
  await renderAll(f.db, f.contextRoot);
}

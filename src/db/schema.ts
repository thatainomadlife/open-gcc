/**
 * GCC v3 SQLite schema.
 *
 * Design: DB is source of truth; markdown files under .gcc/context/ are
 * rendered views regenerated on every mutation. This kills the log rotation
 * race condition (atomic INSERT replaces append+truncate), unlocks real
 * queries for gcc_context, and lays ground for tags / FTS / exports.
 *
 * Commit IDs are project-global monotonic (C001, C002, ...) — they uniquely
 * identify a commit regardless of branch. Matches existing v2 data.
 *
 * No foreign-key CASCADE on branches(parent_id) — we preserve history even
 * if a parent is pruned. ON DELETE CASCADE is used only on join tables.
 */

export const SCHEMA_VERSION = 3;

// PRAGMAs intentionally NOT included here. They are applied per-connection
// in GccDb.applyPragmas() because `journal_mode = WAL` returns a result row
// and silently no-ops when bundled inside a multi-statement db.exec() call.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    UNIQUE NOT NULL,
  purpose     TEXT,
  hypothesis  TEXT,
  conclusion  TEXT,
  outcome     TEXT CHECK (outcome IN ('success','failure','partial','inconclusive') OR outcome IS NULL),
  status      TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','merged','abandoned')),
  parent_id   INTEGER REFERENCES branches(id),
  created_at  TEXT    NOT NULL,
  merged_at   TEXT,
  confidence  TEXT CHECK (confidence IN ('high','medium','low') OR confidence IS NULL),
  template    TEXT CHECK (template IN ('investigation','feature','incident','refactor') OR template IS NULL),
  evidence_files TEXT
);

CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_name   ON branches(name);

CREATE TABLE IF NOT EXISTS active_branch (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  branch_id  INTEGER NOT NULL REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS commits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_id   TEXT    UNIQUE NOT NULL,
  branch_id   INTEGER NOT NULL REFERENCES branches(id),
  ts          TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  what        TEXT    NOT NULL,
  why         TEXT    NOT NULL,
  next_step   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commits_branch ON commits(branch_id);
CREATE INDEX IF NOT EXISTS idx_commits_ts     ON commits(ts DESC);

CREATE TABLE IF NOT EXISTS commit_files (
  commit_id INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  path      TEXT    NOT NULL,
  PRIMARY KEY (commit_id, path)
);

CREATE INDEX IF NOT EXISTS idx_commit_files_path ON commit_files(path);

CREATE TABLE IF NOT EXISTS commit_tags (
  commit_id INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  tag       TEXT    NOT NULL,
  PRIMARY KEY (commit_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_commit_tags_tag ON commit_tags(tag);

CREATE TABLE IF NOT EXISTS commit_links (
  from_commit_id INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  to_commit_id   INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL CHECK (kind IN ('related','supersedes','follows-up')),
  PRIMARY KEY (from_commit_id, to_commit_id, kind)
);

CREATE TABLE IF NOT EXISTS logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id    INTEGER NOT NULL REFERENCES branches(id),
  ts           TEXT    NOT NULL,
  event        TEXT    NOT NULL,
  tool_name    TEXT,
  summary      TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_branch_ts ON logs(branch_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_event     ON logs(event);

CREATE TABLE IF NOT EXISTS project_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS commits_fts USING fts5(
  title, what, why, next_step,
  content=commits,
  content_rowid=id,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS commits_fts_insert AFTER INSERT ON commits BEGIN
  INSERT INTO commits_fts(rowid, title, what, why, next_step)
  VALUES (new.id, new.title, new.what, new.why, new.next_step);
END;

CREATE TRIGGER IF NOT EXISTS commits_fts_delete AFTER DELETE ON commits BEGIN
  INSERT INTO commits_fts(commits_fts, rowid, title, what, why, next_step)
  VALUES ('delete', old.id, old.title, old.what, old.why, old.next_step);
END;

CREATE TRIGGER IF NOT EXISTS commits_fts_update AFTER UPDATE ON commits BEGIN
  INSERT INTO commits_fts(commits_fts, rowid, title, what, why, next_step)
  VALUES ('delete', old.id, old.title, old.what, old.why, old.next_step);
  INSERT INTO commits_fts(rowid, title, what, why, next_step)
  VALUES (new.id, new.title, new.what, new.why, new.next_step);
END;
`;

export const LOG_EVENTS = [
  'session-start',
  'session-end',
  'user-prompt-submit',
  'stop',
  'stop-failure',
  'compact-pre',
  'compact-post',
  'tool-use',
  'tool-use-pre',
  'tool-use-batch',
  'tool-failure',
  'subagent-start',
  'subagent-stop',
  'teammate-idle',
  'task-created',
  'task-completed',
  'worktree-create',
  'worktree-remove',
  'branch-create',
  'branch-merge',
  'commit',
  'instructions-loaded',
  'file-changed',
  'config-change',
  'cwd-changed',
  'permission-request',
  'permission-denied',
  'user-prompt-expansion',
  'elicitation',
  'elicitation-result',
  'notification',
] as const;

export type LogEvent = typeof LOG_EVENTS[number];

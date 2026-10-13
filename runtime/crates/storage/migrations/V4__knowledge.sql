-- V4 知识域（07 §1.5 v0.2：版本管线 + 人工接入 + outbox）
CREATE TABLE knowledge_documents (
  document_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active_version_id TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE knowledge_document_versions (
  version_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES knowledge_documents(document_id),
  version INTEGER NOT NULL,
  content_sha256 TEXT NOT NULL,
  import_status TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  original_filename TEXT,
  published_by TEXT, published_at INTEGER, error_summary TEXT,
  UNIQUE (document_id, version)
);
CREATE TABLE knowledge_import_jobs (
  job_id TEXT PRIMARY KEY,
  document_id TEXT,
  status TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  progress_json TEXT, error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE reply_rules (
  rule_id TEXT PRIMARY KEY,
  source_version_id TEXT,
  sheet_name TEXT, source_row_number INTEGER,
  sequence_number INTEGER,
  keywords_json TEXT NOT NULL,
  reply_content TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global', scope_id TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  confirmed INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_rules_enabled ON reply_rules(enabled, priority);

CREATE TABLE knowledge_chunks (
  chunk_id TEXT PRIMARY KEY,
  source_version_id TEXT NOT NULL,
  title TEXT, content TEXT NOT NULL,
  locator_json TEXT,
  chunk_type TEXT, status TEXT NOT NULL DEFAULT 'candidate',
  created_at INTEGER NOT NULL
);
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  title, content, tokenize='trigram', content='knowledge_chunks', content_rowid='rowid'
);

-- 人工接入（04 §8.5）
CREATE TABLE escalation_rules (
  rule_id TEXT PRIMARY KEY,
  keywords_json TEXT NOT NULL,
  scope_type TEXT, scope_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE escalation_events (
  event_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_detail TEXT,
  notified_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  handled_at INTEGER, handled_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_escalation_pending ON escalation_events(status, created_at);

-- 事务性 outbox（04 §2.2 / 06 §6.0）
CREATE TABLE outbox_jobs (
  job_id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  aggregate_id TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_outbox_pending ON outbox_jobs(status, priority, created_at);

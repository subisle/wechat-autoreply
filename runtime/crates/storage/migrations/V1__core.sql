-- V1 核心（07 §1.2 v0.2：五维来源标注 + 双时间戳）
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  message_id TEXT,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  ingest_source TEXT NOT NULL,
  direction TEXT NOT NULL,
  author_role TEXT NOT NULL,
  outbound_origin TEXT,
  identity_confidence TEXT NOT NULL DEFAULT 'verified',
  msg_type INTEGER NOT NULL,
  content TEXT,
  source_time INTEGER NOT NULL,
  history_local_id INTEGER,               -- 历史导入无 server_id 时的源会话内序号（幂等键退化用）
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_conv ON events(conversation_id, source_time);
CREATE UNIQUE INDEX idx_events_dedupe ON events(conversation_id, message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX idx_events_hist ON events(conversation_id, source_time, history_local_id) WHERE ingest_source='history_import';

CREATE TABLE conversations (
  wxid TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  autoreply_override TEXT NOT NULL DEFAULT 'inherit',
  muted INTEGER NOT NULL DEFAULT 0,
  unread INTEGER NOT NULL DEFAULT 0,
  session_version INTEGER NOT NULL DEFAULT 1,
  last_msg_time INTEGER,
  last_msg_summary TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE contacts (
  wxid TEXT PRIMARY KEY,
  remark TEXT, nickname TEXT, alias TEXT,
  contact_type INTEGER,
  avatar_url TEXT, relationship TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE import_state (
  conversation TEXT PRIMARY KEY,
  cursor_json TEXT NOT NULL,
  scanned_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at INTEGER NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);

CREATE TABLE dnd (
  id INTEGER PRIMARY KEY,
  scope_type TEXT, scope_id TEXT,
  start_time TEXT, end_time TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE schema_history (
  version INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

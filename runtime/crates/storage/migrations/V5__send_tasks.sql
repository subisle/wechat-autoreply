-- V5 (T03): 外发任务状态机（11 §5b）——与学习任务 outbox_jobs 严格分离
CREATE TABLE send_tasks (
  task_id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE,
  conversation_id TEXT NOT NULL,
  reply_id TEXT,
  conversation_version INTEGER NOT NULL,
  last_inbound_msg_id TEXT,
  expire_at INTEGER,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('pending','sending','confirmed','unknown','failed','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  confirmed_at INTEGER,
  external_receipt_id TEXT,
  failure_code TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_send_pending ON send_tasks(status, expire_at);
CREATE INDEX idx_send_conv ON send_tasks(conversation_id, created_at);

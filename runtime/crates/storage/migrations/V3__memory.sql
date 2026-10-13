-- V3 记忆域（04 §3.2 v0.3：状态拆分 + 证据/关系独立表）
CREATE TABLE memories (
  memory_id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','contact','group','business')),
  scope_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('fact','commitment','preference','event','relationship')),
  memory_key TEXT,
  content TEXT NOT NULL,
  structured_data_json TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
  review_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (review_status IN ('candidate','confirmed','rejected')),
  lifecycle_status TEXT NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active','superseded','archived')),
  valid_from INTEGER, valid_until INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  confirmed_at INTEGER, archived_at INTEGER
);
CREATE INDEX idx_mem_scope ON memories(scope_type, scope_id, review_status, lifecycle_status);
CREATE INDEX idx_mem_key ON memories(scope_type, scope_id, memory_key);
CREATE INDEX idx_mem_expiry ON memories(valid_until) WHERE valid_until IS NOT NULL;

-- FTS 与证据拆分对齐：只索引正文（06 评审三.1）
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content, tokenize='trigram', content='memories', content_rowid='rowid'
);
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, evidence)
    VALUES('delete', old.rowid, old.content, old.content);
  INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content)
    VALUES('delete', old.rowid, old.content);
END;

CREATE TABLE memory_evidence (
  evidence_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(memory_id),
  event_id TEXT, source_type TEXT NOT NULL, source_ref TEXT,
  speaker_role TEXT,
  excerpt_redacted TEXT, locator_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_evi_memory ON memory_evidence(memory_id);
CREATE INDEX idx_evi_event ON memory_evidence(event_id);

CREATE TABLE memory_relations (
  memory_id TEXT NOT NULL REFERENCES memories(memory_id),
  related_memory_id TEXT NOT NULL REFERENCES memories(memory_id),
  relation_type TEXT NOT NULL CHECK (relation_type IN ('supports','contradicts','supersedes','related_to')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (memory_id, related_memory_id, relation_type),
  CHECK (memory_id <> related_memory_id)
);

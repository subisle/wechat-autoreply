-- V2 学习域（07 §1.3 v0.2）
CREATE TABLE habit_profiles (
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '',
  profile_version INTEGER NOT NULL DEFAULT 1,
  style_json TEXT, timing_json TEXT,
  relationship TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope_type, scope_id)
);

CREATE TABLE habit_summaries (
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL, sample_count INTEGER,
  generated_at INTEGER NOT NULL,
  PRIMARY KEY (scope_type, scope_id, generated_at)
);

CREATE TABLE sample_replies (
  id INTEGER PRIMARY KEY,
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  source_message_id TEXT, source_type TEXT,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sample_scope ON sample_replies(scope_type, scope_id, confirmed);

CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL, scope_id TEXT,
  status TEXT NOT NULL,
  current_question_id TEXT, analysis_cursor TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
);

CREATE TABLE learning_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_sessions(id),
  role TEXT NOT NULL, content TEXT NOT NULL, turn_type TEXT,
  related_question_id TEXT, created_at TEXT NOT NULL
);

CREATE TABLE learning_observations (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL, scope_id TEXT,
  category TEXT NOT NULL, observation TEXT NOT NULL,
  confidence REAL, evidence_count INTEGER NOT NULL DEFAULT 0,
  source_refs_json TEXT, status TEXT NOT NULL DEFAULT 'candidate',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE learning_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_sessions(id),
  category TEXT, question_text TEXT NOT NULL, reason TEXT,
  evidence_refs_json TEXT, options_json TEXT,
  priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
  answer_text TEXT, created_at TEXT NOT NULL, answered_at TEXT
);

CREATE TABLE strategy_drafts (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES learning_sessions(id),
  strategy_type TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
  conditions_json TEXT, scope_type TEXT NOT NULL, scope_id TEXT,
  evidence_refs_json TEXT, diff_json TEXT, risk_level TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL
);

CREATE TABLE strategy_versions (
  id TEXT PRIMARY KEY,
  strategy_key TEXT NOT NULL, version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '',
  source_draft_id TEXT,
  approval_status TEXT NOT NULL,
  approved_by TEXT, approved_at INTEGER,
  supersedes_version INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (strategy_key, version)
);

-- 活动版本指针（评审四：UI 不得直改）
CREATE TABLE strategy_heads (
  strategy_key TEXT NOT NULL,
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '',
  active_version INTEGER,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (strategy_key, scope_type, scope_id)
);

CREATE TABLE learning_audit_logs (
  id INTEGER PRIMARY KEY, op_type TEXT NOT NULL,
  ref_type TEXT, ref_id TEXT,
  before_status TEXT, after_status TEXT,
  actor TEXT NOT NULL, success INTEGER NOT NULL, error TEXT,
  created_at INTEGER NOT NULL
);

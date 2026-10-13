//! 仓库实现：events 落库（V-04 幂等）、outbox 登记、复合游标推进 —— 同事务（06 §6.0）

use rusqlite::Connection;

use crate::StorageError;

#[derive(Debug, Clone)]
pub struct NewEvent {
    pub message_id: Option<String>,
    pub conversation_id: String,
    pub sender_id: String,
    pub ingest_source: String,   // live_hook | history_import
    pub direction: String,       // inbound | outbound
    pub author_role: String,     // me | contact | system | unknown
    pub outbound_origin: Option<String>,
    pub identity_confidence: String,
    pub msg_type: i64,
    pub content: Option<String>,
    pub source_time: i64,
    pub history_local_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct OutboxJob {
    pub job_id: String,
    pub job_type: String,        // memory_extract | profile_recalc | knowledge_index | vector_index
    pub aggregate_id: Option<String>,
    pub idempotency_key: String,
    pub priority: i64,           // 小者先：实时 > 历史 > 索引
}

/// 单事务：入库(幂等) + 登记 outbox(幂等) + [可选]游标推进（06 §6.0 / 评审 P0-3）
pub fn record_event_with_jobs(
    tx: &Connection,
    event: &NewEvent,
    jobs: &[OutboxJob],
    cursor_update: Option<(&str, &str)>, // (conversation, cursor_json)
) -> Result<bool, StorageError> {
    let inserted = insert_event(tx, event)?;
    if !inserted {
        return Ok(false); // 幂等命中：重复消息不重复登记任务
    }
    for job in jobs {
        tx.execute(
            "INSERT INTO outbox_jobs (job_id, job_type, aggregate_id, idempotency_key, status, attempts, priority, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'pending', 0, ?5, strftime('%s','now'), strftime('%s','now'))
             ON CONFLICT(idempotency_key) DO NOTHING",
            rusqlite::params![job.job_id, job.job_type, job.aggregate_id, job.idempotency_key, job.priority],
        )
        .map_err(|e| StorageError::Sqlite(e.to_string()))?;
    }
    if let Some((conv, cursor)) = cursor_update {
        tx.execute(
            "INSERT INTO import_state (conversation, cursor_json, status, updated_at)
             VALUES (?1, ?2, 'running', strftime('%s','now'))
             ON CONFLICT(conversation) DO UPDATE SET cursor_json=excluded.cursor_json, updated_at=excluded.updated_at",
            rusqlite::params![conv, cursor],
        )
        .map_err(|e| StorageError::Sqlite(e.to_string()))?;
    }
    Ok(true)
}

fn insert_event(tx: &Connection, e: &NewEvent) -> Result<bool, StorageError> {
    let n = tx
        .execute(
            "INSERT OR IGNORE INTO events
             (message_id, conversation_id, sender_id, ingest_source, direction,
              author_role, outbound_origin, identity_confidence, msg_type, content,
              source_time, history_local_id, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,strftime('%s','now'))",
            rusqlite::params![
                e.message_id, e.conversation_id, e.sender_id, e.ingest_source,
                e.direction, e.author_role, e.outbound_origin, e.identity_confidence,
                e.msg_type, e.content, e.source_time, e.history_local_id
            ],
        )
        .map_err(|err| StorageError::Sqlite(err.to_string()))?;
    Ok(n > 0)
}

/// 领取一个待处理任务（简单 FIFO+优先级；单实例够用）
pub fn claim_next_job(tx: &Connection) -> Result<Option<(String, String, Option<String>, String)>, StorageError> {
    let mut stmt = tx
        .prepare(
            "UPDATE outbox_jobs SET status='running', attempts=attempts+1, updated_at=strftime('%s','now')
             WHERE job_id = (SELECT job_id FROM outbox_jobs
                             WHERE status='pending'
                                OR (status='retry_wait' AND next_run_at <= strftime('%s','now'))
                             ORDER BY priority ASC, created_at ASC LIMIT 1)
             RETURNING job_id, job_type, aggregate_id, idempotency_key",
        )
        .map_err(|e| StorageError::Sqlite(e.to_string()))?;
    let mut rows = stmt
        .query([])
        .map_err(|e| StorageError::Sqlite(e.to_string()))?;
    if let Some(row) = rows.next().map_err(|e| StorageError::Sqlite(e.to_string()))? {
        Ok(Some((
            row.get(0).map_err(|e| StorageError::Sqlite(e.to_string()))?,
            row.get(1).map_err(|e| StorageError::Sqlite(e.to_string()))?,
            row.get(2).ok(),
            row.get(3).map_err(|e| StorageError::Sqlite(e.to_string()))?,
        )))
    } else {
        Ok(None)
    }
}

pub fn complete_job(tx: &Connection, job_id: &str) -> Result<(), StorageError> {
    tx.execute(
        "UPDATE outbox_jobs SET status='succeeded', updated_at=strftime('%s','now') WHERE job_id=?1",
        rusqlite::params![job_id],
    )
    .map_err(|e| StorageError::Sqlite(e.to_string()))?;
    Ok(())
}

/// 失败 → retry_wait（有限退避）或 dead_letter（达上限）——11 §3 状态机
pub fn fail_job(tx: &Connection, job_id: &str, error: &str) -> Result<(), StorageError> {
    tx.execute(
        "UPDATE outbox_jobs SET
           status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'retry_wait' END,
           error = ?2,
           next_run_at = CASE WHEN attempts < max_attempts
                         THEN strftime('%s','now') + MIN(?3 * ?3 * 30, 3600)
                         ELSE NULL END,
           updated_at = strftime('%s','now')
         WHERE job_id=?1",
        rusqlite::params![job_id, error, 5i64],
    )
    .map_err(|e| StorageError::Sqlite(e.to_string()))?;
    Ok(())
}

/// 领取任务时只取 pending 或退避到期的 retry_wait
pub const CLAIM_SQL: &str =
    "WHERE status='pending' OR (status='retry_wait' AND next_run_at <= strftime('%s','now'))";
